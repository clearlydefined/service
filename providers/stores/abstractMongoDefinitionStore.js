// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')
const { get } = require('lodash')
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
  'licensed.score.total': (value) => value && parseInt(value),
  'described.score.total': (value) => value && parseInt(value),
  'scores.effective': (value) => value && parseInt(value),
  'scores.tool': (value) => value && parseInt(value)
}

const SEPARATOR = '&'

class AbstractMongoDefinitionStore {
  constructor(options) {
    this.logger = options.logger || logger()
    this.options = options
  }

  initialize() {
    return promiseRetry(async (retry) => {
      try {
        this.client = await MongoClient.connect(this.options.connectionString, { useNewUrlParser: true })
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection(this.options.collectionName)
        this._createIndexes()
      } catch (error) {
        retry(error)
      }
    })
  }

  _createIndexes() {
    //This is for documentation purpose only.
    this.collection.createIndex({ '_meta.updated': 1 })

    const coordinatesKey = this.getCoordinatesKey()
    this.collection.createIndex({ [coordinatesKey]: 1 })
    this.collection.createIndex({ 'coordinates.type': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'coordinates.provider': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'coordinates.name': 1, 'coordinates.revision': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({
      'coordinates.namespace': 1,
      'coordinates.name': 1,
      'coordinates.revision': 1,
      [coordinatesKey]: 1
    })
    this.collection.createIndex({ 'coordinates.revision': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'licensed.declared': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'described.releaseDate': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'licensed.score.total': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'described.score.total': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'scores.effective': 1, [coordinatesKey]: 1 })
    this.collection.createIndex({ 'scores.tool': 1, [coordinatesKey]: 1 })
  }

  async close() {
    await this.client.close()
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  // eslint-disable-next-line no-unused-vars
  async list(coordinates) {
    throw new Error('Unsupported Operation')
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {Coordinates} coordinates - The coordinates of the object to get
   * @returns The loaded object
   */
  // eslint-disable-next-line no-unused-vars
  async get(coordinates) {
    throw new Error('Unsupported Operation')
  }

  /**
   * Query and return the objects based on the query
   *
   * @param {object} query - The filters and sorts for the request
   * @returns The data and continuationToken if there is more results
   */
  async find(query, continuationToken = '', pageSize = 100, projection) {
    const sort = this._buildSort(query)
    const combinedFilters = this._buildQueryWithPaging(query, continuationToken, sort)
    this.logger.debug(`filter: ${JSON.stringify(combinedFilters)}\nsort: ${JSON.stringify(sort)}`)
    const cursor = this.collection.find(combinedFilters, {
      projection,
      sort,
      limit: pageSize
    })
    const data = await cursor.toArray()
    continuationToken = this._getContinuationToken(pageSize, data, sort)
    return { data, continuationToken }
  }

  // eslint-disable-next-line no-unused-vars
  async store(definition) {
    throw new Error('Unsupported Operation')
  }

  // eslint-disable-next-line no-unused-vars
  async delete(coordinates) {
    throw new Error('Unsupported Operation')
  }

  getId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates).toString().toLowerCase()
  }

  buildQuery(parameters) {
    const filter = {}
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
    const sortDirection = parameters.sortDesc ? -1 : 1
    sort.forEach((item) => (clause[item] = sortDirection))
    //Always sort on coordinatesKey(_id or partitionKey) for continuation token
    const coordinateKey = this.getCoordinatesKey()
    clause[coordinateKey] = sortDirection
    return clause
  }

  _buildQueryWithPaging(query, continuationToken, sort) {
    const filter = this.buildQuery(query)
    const paginationFilter = this._buildPaginationQuery(continuationToken, sort)
    return paginationFilter ? { $and: [filter, paginationFilter] } : filter
  }

  _buildPaginationQuery(continuationToken, sort) {
    if (!continuationToken.length) return
    const queryExpressions = this._buildQueryExpressions(continuationToken, sort)
    return queryExpressions.length <= 1 ? queryExpressions[0] : { $or: [...queryExpressions] }
  }

  _buildQueryExpressions(continuationToken, sort) {
    const lastValues = base64.decode(continuationToken)
    const sortValues = lastValues.split(SEPARATOR).map((value) => (value.length ? value : null))

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
      return { ...filter, ...filterForSort }
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
        $or: [filter, { [sortField]: null }]
      }
    }
    return filter
  }

  _getContinuationToken(pageSize, data, sortClause) {
    if (data.length !== pageSize) return ''
    const lastItem = data[data.length - 1]
    const lastValues = Object.keys(sortClause)
      .map((key) => get(lastItem, key))
      .join(SEPARATOR)
    return base64.encode(lastValues)
  }
}
module.exports = AbstractMongoDefinitionStore
