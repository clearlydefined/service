// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')
const { get } = require('lodash')
const base64 = require('base-64')

/**
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionStoreOptions} MongoDefinitionStoreOptions
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionQuery} MongoDefinitionQuery
 * @typedef {import('./abstractMongoDefinitionStore').FindResult} FindResult
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('mongodb').Db} Db
 * @typedef {import('mongodb').Collection} Collection
 * @typedef {import('mongodb').MongoClient} MongoClientType
 */

/** @type {Record<string, string[]>} */
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

/** @type {Record<string, (value: any) => number | undefined>} */
const valueTransformers = {
  'licensed.score.total': value => value && parseInt(value),
  'described.score.total': value => value && parseInt(value),
  'scores.effective': value => value && parseInt(value),
  'scores.tool': value => value && parseInt(value)
}

const SEPARATOR = '&'

/**
 * Abstract base class for MongoDB-based definition store implementations.
 * Provides common functionality for querying and storing definitions in MongoDB.
 */
class AbstractMongoDefinitionStore {
  /**
   * Creates a new AbstractMongoDefinitionStore instance
   *
   * @param {MongoDefinitionStoreOptions} options - Configuration options for the store
   */
  constructor(options) {
    /** @type {Logger} */
    this.logger = options.logger || logger()
    /** @type {MongoDefinitionStoreOptions} */
    this.options = options
  }

  /**
   * Initializes the MongoDB connection and creates indexes
   *
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(this.options.connectionString)
        this.logger.info('MongoDB connection initialized', {
          database: this.options.dbName,
          collection: this.options.collectionName
        })
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection(this.options.collectionName)
        await this._createIndexes()
      } catch (error) {
        const err = /** @type {Error} */ (error)
        this.logger.info(`retrying mongo connection: ${err.message}`)
        retry(error)
      }
    })
  }

  async _createIndexes() {
    const coordinatesKey = this.getCoordinatesKey()

    // Wrap all createIndex operations in Promise.all to handle them properly
    return Promise.all([
      //This is for documentation purpose only.
      this.collection.createIndex({ '_meta.updated': 1 }),

      this.collection.createIndex({ [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'coordinates.type': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'coordinates.provider': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'coordinates.name': 1, 'coordinates.revision': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({
        'coordinates.namespace': 1,
        'coordinates.name': 1,
        'coordinates.revision': 1,
        [coordinatesKey]: 1
      }),
      this.collection.createIndex({ 'coordinates.revision': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'licensed.declared': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'described.releaseDate': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'licensed.score.total': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'described.score.total': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'scores.effective': 1, [coordinatesKey]: 1 }),
      this.collection.createIndex({ 'scores.tool': 1, [coordinatesKey]: 1 }),

      //Single field indexes are used for filtering in Cosmo DB
      //https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/troubleshoot-query-performance#include-necessary-indexes)
      this.collection.createIndex({ 'coordinates.name': 1 }),
      this.collection.createIndex({ 'coordinates.revision': 1 }),
      this.collection.createIndex({ 'coordinates.type': 1 }),
      this.collection.createIndex({ 'described.releaseDate': 1 }),
      this.collection.createIndex({ 'licensed.declared': 1 }),
      this.collection.createIndex({ 'scores.effective': 1 })
    ]).catch(error => {
      // Log the error but don't fail initialization if indexes can't be created
      this.logger.warn('Failed to create some indexes', { error: error.message })
    })
  }

  /**
   * Closes the MongoDB connection
   *
   * @returns {Promise<void>} Promise that resolves when the connection is closed
   */
  async close() {
    await this.client.close()
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates. Must be implemented by subclasses.
   *
   * @param {import('../../lib/entityCoordinates')} _coordinates - The coordinates to match
   * @returns {Promise<string[]>} A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   * @throws {Error} If not implemented by subclass
   */
  // eslint-disable-next-line no-unused-vars
  async list(_coordinates) {
    throw new Error('Unsupported Operation')
  }

  /**
   * Get and return the object at the given coordinates.
   * Must be implemented by subclasses.
   *
   * @param {import('../../lib/entityCoordinates')} _coordinates - The coordinates of the object to get
   * @returns {Promise<any>} The loaded object or null if not found
   * @throws {Error} If not implemented by subclass
   */
  // eslint-disable-next-line no-unused-vars
  async get(_coordinates) {
    throw new Error('Unsupported Operation')
  }

  /**
   * Query and return the objects based on the query
   *
   * @param {MongoDefinitionQuery} query - The filters and sorts for the request
   * @param {string} [continuationToken=''] - Token for pagination
   * @param {number} [pageSize=100] - Number of results per page
   * @param {object} [projection] - Optional projection for returned documents
   * @returns {Promise<FindResult>} The data and continuationToken if there are more results
   */
  async find(query, continuationToken = '', pageSize = 100, projection) {
    const sort = this._buildSort(query)
    const combinedFilters = this._buildQueryWithPaging(query, continuationToken, sort)
    this.logger.debug(`filter: ${JSON.stringify(combinedFilters)}\nsort: ${JSON.stringify(sort)}`)
    const cursor = this.collection.find(combinedFilters, {
      projection,
      // @ts-ignore - mongodb types expect strict Sort type but our Record<string, number> is equivalent
      sort,
      limit: pageSize
    })
    const data = await cursor.toArray()
    continuationToken = this._getContinuationToken(pageSize, data, sort)
    return { data, continuationToken }
  }

  /**
   * Store a definition. Must be implemented by subclasses.
   *
   * @param {any} _definition - The definition to store
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  // eslint-disable-next-line no-unused-vars
  async store(_definition) {
    throw new Error('Unsupported Operation')
  }

  /**
   * Delete a definition. Must be implemented by subclasses.
   *
   * @param {import('../../lib/entityCoordinates')} _coordinates - The coordinates of the definition to delete
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  // eslint-disable-next-line no-unused-vars
  async delete(_coordinates) {
    throw new Error('Unsupported Operation')
  }

  /**
   * Gets the ID string from coordinates
   *
   * @param {import('../../lib/entityCoordinates') | null | undefined} coordinates - The coordinates
   * @returns {string} The ID string (lowercased coordinate string)
   */
  getId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates).toString().toLowerCase()
  }

  /**
   * Builds a MongoDB filter from query parameters
   *
   * @param {MongoDefinitionQuery} parameters - The query parameters
   * @returns {Record<string, any>} The MongoDB filter object
   */
  buildQuery(parameters) {
    /** @type {Record<string, any>} */
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
    if (parameters.minEffectiveScore)
      filter['scores.effective'] = { $gt: parseInt(String(parameters.minEffectiveScore)) }
    if (parameters.maxEffectiveScore)
      filter['scores.effective'] = { $lt: parseInt(String(parameters.maxEffectiveScore)) }
    if (parameters.minToolScore) filter['scores.tool'] = { $gt: parseInt(String(parameters.minToolScore)) }
    if (parameters.maxToolScore) filter['scores.tool'] = { $lt: parseInt(String(parameters.maxToolScore)) }
    if (parameters.minLicensedScore)
      filter['licensed.score.total'] = { $gt: parseInt(String(parameters.minLicensedScore)) }
    if (parameters.maxLicensedScore)
      filter['licensed.score.total'] = { $lt: parseInt(String(parameters.maxLicensedScore)) }
    if (parameters.minDescribedScore)
      filter['described.score.total'] = { $gt: parseInt(String(parameters.minDescribedScore)) }
    if (parameters.maxDescribedScore)
      filter['described.score.total'] = { $lt: parseInt(String(parameters.maxDescribedScore)) }
    return filter
  }

  /**
   * Gets the key field used for coordinates (to be overridden by subclasses)
   *
   * @returns {string} The coordinates key field name
   */
  getCoordinatesKey() {
    return '_id'
  }

  /**
   * Builds a sort clause from query parameters
   *
   * @protected
   * @param {MongoDefinitionQuery} parameters - The query parameters
   * @returns {Record<string, number>} The MongoDB sort object
   */
  _buildSort(parameters) {
    const sort = sortOptions[parameters.sort || ''] || []
    /** @type {Record<string, number>} */
    const clause = {}
    const sortDirection = parameters.sortDesc ? -1 : 1
    sort.forEach(item => (clause[item] = sortDirection))
    //Always sort on coordinatesKey(_id or partitionKey) for continuation token
    const coordinateKey = this.getCoordinatesKey()
    clause[coordinateKey] = sortDirection
    return clause
  }

  /**
   * Builds a query with pagination filters
   *
   * @protected
   * @param {MongoDefinitionQuery} query - The query parameters
   * @param {string} continuationToken - The continuation token
   * @param {Record<string, number>} sort - The sort clause
   * @returns {Record<string, any>} The combined filter with pagination
   */
  _buildQueryWithPaging(query, continuationToken, sort) {
    const filter = this.buildQuery(query)
    const paginationFilter = this._buildPaginationQuery(continuationToken, sort)
    return paginationFilter ? { $and: [filter, paginationFilter] } : filter
  }

  /**
   * Builds pagination query from continuation token
   *
   * @protected
   * @param {string} continuationToken - The continuation token
   * @param {Record<string, number>} sort - The sort clause
   * @returns {Record<string, any> | undefined} The pagination filter or undefined
   */
  _buildPaginationQuery(continuationToken, sort) {
    if (!continuationToken.length) return undefined
    const queryExpressions = this._buildQueryExpressions(continuationToken, sort)
    return queryExpressions.length <= 1 ? queryExpressions[0] : { $or: [...queryExpressions] }
  }

  /**
   * Builds query expressions for pagination
   *
   * @protected
   * @param {string} continuationToken - The continuation token
   * @param {Record<string, number>} sort - The sort clause
   * @returns {Record<string, any>[]} Array of filter expressions
   */
  _buildQueryExpressions(continuationToken, sort) {
    const lastValues = base64.decode(continuationToken)
    const sortValues = lastValues.split(SEPARATOR).map(value => (value.length ? value : null))

    /** @type {Record<string, any>[]} */
    const queryExpressions = []
    const sortConditions = Object.entries(sort)
    for (let nSorts = 1; nSorts <= sortConditions.length; nSorts++) {
      const subList = sortConditions.slice(0, nSorts)
      queryExpressions.push(this._buildQueryExpression(subList, sortValues))
    }
    return queryExpressions
  }

  /**
   * Builds a single query expression for pagination
   *
   * @protected
   * @param {[string, number][]} sortConditions - The sort conditions
   * @param {(string | null)[]} sortValues - The values from the continuation token
   * @returns {Record<string, any>} The filter expression
   */
  _buildQueryExpression(sortConditions, sortValues) {
    return sortConditions.reduce((filter, [sortField, sortDirection], index) => {
      const transform = valueTransformers[sortField]
      /** @type {string | number | null | undefined} */
      let sortValue = sortValues[index]
      sortValue = transform ? transform(sortValue) : sortValue
      const isLast = index === sortConditions.length - 1
      const filterForSort = this._buildQueryForSort(isLast, sortField, sortValue, sortDirection)
      return { ...filter, ...filterForSort }
    }, /** @type {Record<string, any>} */ ({}))
  }

  /**
   * Builds a filter for a single sort field
   *
   * @protected
   * @param {boolean} isTieBreaker - Whether this is the tie-breaker field
   * @param {string} sortField - The field name
   * @param {string | number | null | undefined} sortValue - The value to compare against
   * @param {number} sortDirection - The sort direction (1 or -1)
   * @returns {Record<string, any>} The filter for this sort field
   */
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

  /**
   * Gets the continuation token for the next page
   *
   * @protected
   * @param {number} pageSize - The page size
   * @param {any[]} data - The current page data
   * @param {Record<string, number>} sortClause - The sort clause
   * @returns {string} The continuation token or empty string if no more pages
   */
  _getContinuationToken(pageSize, data, sortClause) {
    if (data.length !== pageSize) return ''
    const lastItem = data[data.length - 1]
    const lastValues = Object.keys(sortClause)
      .map(key => get(lastItem, key))
      .join(SEPARATOR)
    return base64.encode(lastValues)
  }
}
module.exports = AbstractMongoDefinitionStore
