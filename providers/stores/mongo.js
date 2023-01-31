// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')
const { clone, get, range } = require('lodash')
const base64 = require('base-64')

const sortOptions = {
  type: ['coordinates.type'],
  provider: ['coordinates.provider'],
  name: ['coordinates.name', 'coordinates.revision'],
  namespace: ['coordinates.namespace', 'coordinates.name', 'coordinates.revision'],
  revision: ['coordinates.revision'],
  license: ['licensed.declared'],
  releaseDate: ['described.releaseDate'],
  licensedScore: ['licensed.score.total'],
  describedScore: ['described.score.total'],
  effectiveScore: ['scores.effective'],
  toolScore: ['scores.tool']
}

const valueTransformers = {
  'licensed.score.total': value => value && parseInt(value),
  'described.score.total': value => value && parseInt(value),
  'scores.effective': value => value && parseInt(value),
  'scores.tool': value => value && parseInt(value)
}

const SEPARATOR = '&'

class MongoStore {
  constructor(options) {
    this.logger = options.logger || logger()
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
      { projection: { _id: 0, _mongo: 0 }, sort: { '_mongo.page': 1 } }
    )
    let definition
    await cursor.forEach(page => {
      if (!definition) definition = page
      else definition.files = definition.files.concat(page.files)
    })
    return definition
  }

  /**
   * Query and return the objects based on the query
   *
   * @param {object} query - The filters and sorts for the request
   * @returns The data and continuationToken if there is more results
   */
  async find(query, continuationToken = '', pageSize = 100) {
    const sort = this._buildSort(query)
    const combinedFilters = this._buildQueryWithPaging(query, continuationToken, sort)
    this.logger.debug(`filter: ${JSON.stringify(combinedFilters)}\nsort: ${JSON.stringify(sort)}`)
    const cursor = await this.collection.find(combinedFilters, {
      projection: { _id: 0, files: 0 },
      sort: sort,
      limit: pageSize
    })
    const data = await cursor.toArray()
    continuationToken = this._getContinuationToken(pageSize, data, sort)
    data.forEach(def => {
      delete def._mongo
    })
    return { data, continuationToken }
  }

  async store(definition) {
    const pageSize = 1000
    definition._id = this._getId(definition.coordinates)
    await this.collection.deleteMany({ '_mongo.partitionKey': definition._id })
    const pages = Math.ceil((get(definition, 'files.length') || 1) / pageSize)
    const result = await this.collection.insertMany(
      range(pages).map(
        index => {
          if (index === 0) {
            const definitionPage = clone(definition)
            if (definition.files) definitionPage.files = definition.files.slice(0, pageSize)
            return { ...definitionPage, _mongo: { partitionKey: definition._id, page: 1, totalPages: pages } }
          }
          return {
            _id: definition._id + `/${index}`,
            _mongo: {
              partitionKey: definition._id,
              page: index + 1,
              totalPages: pages
            },
            files: definition.files.slice(index * pageSize, index * pageSize + pageSize)
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

  _buildQuery(parameters) {
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
    if (parameters.minEffectiveScore) filter['scores.effective'] = { $gt: parseInt(parameters.minEffectiveScore) }
    if (parameters.maxEffectiveScore) filter['scores.effective'] = { $lt: parseInt(parameters.maxEffectiveScore) }
    if (parameters.minToolScore) filter['scores.tool'] = { $gt: parseInt(parameters.minToolScore) }
    if (parameters.maxToolScore) filter['scores.tool'] = { $lt: parseInt(parameters.maxToolScore) }
    if (parameters.minLicensedScore) filter['licensed.score.total'] = { $gt: parseInt(parameters.minLicensedScore) }
    if (parameters.maxLicensedScore) filter['licensed.score.total'] = { $lt: parseInt(parameters.maxLicensedScore) }
    if (parameters.minDescribedScore) filter['described.score.total'] = { $gt: parseInt(parameters.minDescribedScore) }
    if (parameters.maxDescribedScore) filter['described.score.total'] = { $lt: parseInt(parameters.maxDescribedScore) }
    return filter
  }

  _buildSort(parameters) {
    const sort = sortOptions[parameters.sort] || []
    const clause = {}
    sort.forEach(item => clause[item] = parameters.sortDesc ? -1 : 1)
    //Always sort ascending on partitionKey for continuation token
    clause['_mongo.partitionKey'] = 1
    return clause
  }

  _buildQueryWithPaging(query, continuationToken, sort) {
    const filter = this._buildQuery(query)
    const paginationFilter = this._buildPaginationQuery(continuationToken, sort)
    return paginationFilter ? { $and: [filter, paginationFilter] } : filter
  }

  _buildPaginationQuery(continuationToken, sort) {
    if (!continuationToken.length) return
    const queryExpressions = this._buildQueryExpressions(continuationToken, sort)
    return queryExpressions.length <= 1 ?
      queryExpressions [0] :
      { $or: [ ...queryExpressions ] }
  }

  _buildQueryExpressions(continuationToken, sort) {
    const lastValues = base64.decode(continuationToken)
    const sortValues = lastValues.split(SEPARATOR).map(value => value.length ? value : null)

    const queryExpressions = []
    const sortConditions = Object.entries(sort)
    for (let nSorts = 1; nSorts <= sortConditions.length; nSorts++) {
      const subList = sortConditions.slice(0, nSorts)
      queryExpressions.push(this._buildQueryExpression(subList, sortValues))
    }
    return queryExpressions
  }

  _buildQueryExpression(sortConditions, sortValues) {
    return sortConditions.reduce((filter, [sortField, sortDirection], index) => {
      const transform = valueTransformers[sortField]
      let sortValue = sortValues[index]
      sortValue = transform ? transform(sortValue) : sortValue
      const isLast = index === sortConditions.length - 1
      const filterForSort = this._buildQueryForSort(isLast, sortField, sortValue, sortDirection)
      return { ...filter, ...filterForSort}
    }, {})
  }

  _buildQueryForSort(isTieBreaker, sortField, sortValue, sortDirection) {
    let operator = '$eq'
    if (isTieBreaker) {
      if (sortDirection === 1) {
        operator = sortValue === null ? '$ne' : '$gt'
      } else {
        operator = '$lt'
      }  
    }
    const filter = { [sortField]: { [operator]: sortValue } }

    //Less than non null value should include null as well
    if (operator === '$lt' && sortValue) {
      return {
        $or: [
          filter,
          { [sortField]: null }
        ]
      }
    }
    return filter
  }

  _getContinuationToken(pageSize, data, sortClause) {
    if (data.length !== pageSize) return ''
    const lastItem = data[data.length - 1]
    const lastValues = Object.keys(sortClause)
      .map(key => get(lastItem, key))
      .join(SEPARATOR)
    return base64.encode(lastValues)
  }

  async close() {
    await this.client.close()
  }
}
module.exports = options => new MongoStore(options)
