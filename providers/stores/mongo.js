// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')
const { clone, get, range } = require('lodash')
const base64 = require('base-64')
const uuid = require('uuid').v4

const sortOptions = {
  type: 'coordinates.type',
  provider: 'coordinates.provider',
  name: 'coordinates.name',
  namespace: 'coordinates.namespace',
  license: 'licensed.declared',
  releaseDate: 'described.releaseDate',
  licensedScore: 'licensed.score.total',
  describedScore: 'described.score.total'
}

class MongoStore {
  constructor(options) {
    this.logger = logger()
    this.options = options
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(this.options.connectionString, { useNewUrlParser: true })
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection(this.options.collectionName)
      } catch (error) {
        retry(error)
      }
    })
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
    const list = await this.collection.find(
      { '_mongo.partitionKey': new RegExp(`^${this._getId(coordinates)}`), '_mongo.page': 1 },
      { projection: { _id: 1 } }
    )
    return (await list.toArray()).map(entry => entry._id)
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {Coordinates} coordinates - The coordinates of the object to get
   * @returns The loaded object
   */
  async get(coordinates) {
    const cursor = await this.collection.find(
      { '_mongo.partitionKey': this._getId(coordinates) },
      { projection: { _id: 0 }, sort: { '_mongo.page': 1 } }
    )
    let definition
    await cursor.forEach(page => {
      if (!definition) definition = page
      else if (page._mongo.slug === definition._mongo.slug) definition.files = definition.files.concat(page.files)
    })
    if (definition) delete definition._mongo
    return definition
  }

  /**
   * Query and return the objects based on the query
   *
   * @param {object} query - The filters and sorts for the request
   * @returns The data and continuationToken if there is more results
   */
  async find(query, continuationToken = '') {
    const pageSize = 50 // no option for page size, just next tokens
    const filter = this._buildQuery(query, continuationToken)
    const sort = this._buildSort(query)
    const cursor = await this.collection.find(filter, {
      projection: { _id: 0, files: 0 },
      sort: sort,
      limit: pageSize
    })
    const data = await cursor.toArray()
    continuationToken = this._getContinuationToken(pageSize, data)
    data.forEach(def => {
      delete def._mongo
    })
    return { data, continuationToken }
  }

  /**
   * Query and perform an aggregate average on the defintions
   *
   * @param {object} query - The filters for the request
   * @param {string[]} fields - The fields to average
   * @returns The result of the aggregation
   */
  async average(query, fields) {
    const filter = this._buildQuery(query)
    const groups = fields.reduce((result, field) => {
      result[`avg_${field}`] = { $avg: `$${field}` }
      return result
    }, {})
    const data = await this.collection
      .aggregate([
        { $match: filter },
        {
          $group: {
            ...groups,
            _id: null,
            totalcount: { $sum: 1 }
          }
        }
      ])
      .project({ _id: 0 })
      .toArray()
    return data[0]
  }

  async store(definition) {
    const pageSize = 1000
    definition._id = this._getId(definition.coordinates)
    const pages = Math.ceil((get(definition, 'files.length') || 1) / pageSize)
    const slug = uuid()
    const result = await this.collection.bulkWrite(
      range(pages).map(
        index => {
          if (index === 0) {
            const definitionPage = clone(definition)
            if (definition.files) definitionPage.files = definition.files.slice(0, pageSize)
            return {
              updateOne: {
                filter: { _id: definition._id },
                update: {
                  $set: {
                    ...definitionPage,
                    _mongo: { partitionKey: definition._id, page: 1, totalPages: pages, slug }
                  }
                },
                upsert: true
              }
            }
          }
          return {
            updateOne: {
              filter: { _id: definition._id + `/${slug}/${index}` },
              update: {
                $set: {
                  _id: definition._id + `/${slug}/${index}`,
                  _mongo: {
                    partitionKey: definition._id,
                    page: index + 1,
                    totalPages: pages,
                    slug
                  },
                  files: definition.files.slice(index * pageSize, index * pageSize + pageSize)
                }
              }
            }
          }
        },
        { ordered: false }
      )
    )
    return result
  }

  async delete(coordinates) {
    await this.collection.deleteMany({ '_mongo.partitionKey': this._getId(coordinates) })
    return null
  }

  _getId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()
  }

  _buildQuery(parameters, continuationToken) {
    const filter = { '_mongo.page': 1 } // only get page 1 of each definition
    if (parameters.type) filter['coordinates.type'] = parameters.type
    if (parameters.provider) filter['coordinates.provider'] = parameters.provider
    if (parameters.namespace) filter['coordinates.namespace'] = parameters.namespace
    if (parameters.name) filter['coordinates.name'] = parameters.name
    if (parameters.type === null) filter['coordinates.type'] = null
    if (parameters.provider === null) filter['coordinates.provider'] = null
    if (parameters.name === null) filter['coordinates.name'] = null
    if (parameters.namespace === null) filter['coordinates.namespace'] = null
    if (parameters.license) filter['licensed.declared'] = parameters.license
    if (parameters.releasedAfter) filter['described.releaseDate'] = { $gt: parameters.releasedAfter }
    if (parameters.releasedBefore) filter['described.releaseDate'] = { $lt: parameters.releasedBefore }
    if (parameters.minLicensedScore) filter['licensed.score.total'] = { $gt: parseInt(parameters.minLicensedScore) }
    if (parameters.maxLicensedScore) filter['licensed.score.total'] = { $lt: parseInt(parameters.maxLicensedScore) }
    if (parameters.minDescribedScore) filter['described.score.total'] = { $gt: parseInt(parameters.minDescribedScore) }
    if (parameters.maxDescribedScore) filter['described.score.total'] = { $lt: parseInt(parameters.maxDescribedScore) }
    if (continuationToken) filter['_mongo.partitionKey'] = { $gt: base64.decode(continuationToken) }
    return filter
  }

  _buildSort(parameters) {
    const sort = sortOptions[parameters.sort] || '_mongo.partitionKey'
    return { [sort]: parameters.sortDesc ? -1 : 1 }
  }

  _getContinuationToken(pageSize, data) {
    if (data.length !== pageSize) return ''
    return base64.encode(data[data.length - 1]._mongo.partitionKey)
  }
}

module.exports = options => new MongoStore(options)
