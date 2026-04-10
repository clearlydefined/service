// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { Collection, Db, Document, Filter } from 'mongodb'
import { MongoClient } from 'mongodb'
import promiseRetry from 'promise-retry'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import EntityCoordinatesClass from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'

const { get } = lodash

import base64 from 'base-64'

/** Options for configuring an AbstractMongoDefinitionStore */
export interface MongoDefinitionStoreOptions {
  /** MongoDB connection string */
  connectionString: string
  /** Database name */
  dbName: string
  /** Collection name */
  collectionName: string
  /** Optional logger instance */
  logger?: Logger
}

/** Query parameters for finding definitions */
export interface MongoDefinitionQuery {
  /** Filter by component type */
  type?: string | null
  /** Filter by provider */
  provider?: string | null
  /** Filter by namespace */
  namespace?: string | null
  /** Filter by name */
  name?: string | null
  /** Filter by declared license */
  license?: string
  /** Filter by release date (after) */
  releasedAfter?: string
  /** Filter by release date (before) */
  releasedBefore?: string
  /** Filter by minimum effective score */
  minEffectiveScore?: string | number
  /** Filter by maximum effective score */
  maxEffectiveScore?: string | number
  /** Filter by minimum tool score */
  minToolScore?: string | number
  /** Filter by maximum tool score */
  maxToolScore?: string | number
  /** Filter by minimum licensed score */
  minLicensedScore?: string | number
  /** Filter by maximum licensed score */
  maxLicensedScore?: string | number
  /** Filter by minimum described score */
  minDescribedScore?: string | number
  /** Filter by maximum described score */
  maxDescribedScore?: string | number
  /** Sort field */
  sort?: string
  /** Sort descending */
  sortDesc?: boolean
}

/** Result from find operation with pagination */
export interface FindResult<T = any> {
  /** Array of matching documents */
  data: T[]
  /** Continuation token for next page, empty string if no more results */
  continuationToken: string
}

const sortOptions: Record<string, string[]> = {
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

const valueTransformers: Record<string, (value: any) => number | undefined> = {
  'licensed.score.total': value => value && Number.parseInt(value, 10),
  'described.score.total': value => value && Number.parseInt(value, 10),
  'scores.effective': value => value && Number.parseInt(value, 10),
  'scores.tool': value => value && Number.parseInt(value, 10)
}

const SEPARATOR = '&'

/**
 * Abstract base class for MongoDB-based definition store implementations.
 * Provides common functionality for querying and storing definitions in MongoDB.
 */
class AbstractMongoDefinitionStore {
  logger: Logger
  options: MongoDefinitionStoreOptions
  declare client: MongoClient
  declare db: Db
  declare collection: Collection

  constructor(options: MongoDefinitionStoreOptions) {
    this.logger = options.logger || logger()
    this.options = options
  }

  /**
   * Initializes the MongoDB connection and creates indexes
   */
  initialize(): Promise<void> {
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
        const err = error as Error
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
   */
  async close(): Promise<void> {
    await this.client.close()
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   */
  // eslint-disable-next-line no-unused-vars
  async list(_coordinates: EntityCoordinates): Promise<string[]> {
    throw new Error('Unsupported Operation')
  }

  /**
   * Get and return the object at the given coordinates.
   */
  // eslint-disable-next-line no-unused-vars
  async get(_coordinates: EntityCoordinates): Promise<any> {
    throw new Error('Unsupported Operation')
  }

  /**
   * Query and return the objects based on the query
   */
  async find(
    query: MongoDefinitionQuery,
    continuationToken = '',
    pageSize = 100,
    projection?: Document
  ): Promise<FindResult> {
    const sort = this._buildSort(query)
    const combinedFilters = this._buildQueryWithPaging(query, continuationToken, sort)
    this.logger.debug(`filter: ${JSON.stringify(combinedFilters)}\nsort: ${JSON.stringify(sort)}`)
    const cursor = this.collection.find(combinedFilters, {
      projection,
      // @ts-expect-error - mongodb types expect strict Sort type but our Record<string, number> is equivalent
      sort,
      limit: pageSize
    })
    const data = await cursor.toArray()
    continuationToken = this._getContinuationToken(pageSize, data, sort)
    return { data, continuationToken }
  }

  /**
   * Store a definition.
   */
  // eslint-disable-next-line no-unused-vars
  async store(_definition: any): Promise<void> {
    throw new Error('Unsupported Operation')
  }

  /**
   * Delete a definition.
   */
  // eslint-disable-next-line no-unused-vars
  async delete(_coordinates: EntityCoordinates): Promise<void> {
    throw new Error('Unsupported Operation')
  }

  getId(coordinates: EntityCoordinates | null | undefined): string {
    if (!coordinates) {
      return ''
    }
    return EntityCoordinatesClass.fromObject(coordinates).toString().toLowerCase()
  }

  buildQuery(parameters: MongoDefinitionQuery): Filter<Document> {
    const filter: Record<string, any> = {}
    if (parameters.type) {
      filter['coordinates.type'] = parameters.type
    }
    if (parameters.provider) {
      filter['coordinates.provider'] = parameters.provider
    }
    if (parameters.namespace) {
      filter['coordinates.namespace'] = parameters.namespace
    }
    if (parameters.name) {
      filter['coordinates.name'] = parameters.name
    }
    if (parameters.type === null) {
      filter['coordinates.type'] = null
    }
    if (parameters.provider === null) {
      filter['coordinates.provider'] = null
    }
    if (parameters.name === null) {
      filter['coordinates.name'] = null
    }
    if (parameters.namespace === null) {
      filter['coordinates.namespace'] = null
    }
    if (parameters.license) {
      filter['licensed.declared'] = parameters.license
    }
    if (parameters.releasedAfter) {
      filter['described.releaseDate'] = { $gt: parameters.releasedAfter }
    }
    if (parameters.releasedBefore) {
      filter['described.releaseDate'] = { $lt: parameters.releasedBefore }
    }
    if (parameters.minEffectiveScore) {
      filter['scores.effective'] = { $gt: Number.parseInt(String(parameters.minEffectiveScore), 10) }
    }
    if (parameters.maxEffectiveScore) {
      filter['scores.effective'] = { $lt: Number.parseInt(String(parameters.maxEffectiveScore), 10) }
    }
    if (parameters.minToolScore) {
      filter['scores.tool'] = { $gt: Number.parseInt(String(parameters.minToolScore), 10) }
    }
    if (parameters.maxToolScore) {
      filter['scores.tool'] = { $lt: Number.parseInt(String(parameters.maxToolScore), 10) }
    }
    if (parameters.minLicensedScore) {
      filter['licensed.score.total'] = { $gt: Number.parseInt(String(parameters.minLicensedScore), 10) }
    }
    if (parameters.maxLicensedScore) {
      filter['licensed.score.total'] = { $lt: Number.parseInt(String(parameters.maxLicensedScore), 10) }
    }
    if (parameters.minDescribedScore) {
      filter['described.score.total'] = { $gt: Number.parseInt(String(parameters.minDescribedScore), 10) }
    }
    if (parameters.maxDescribedScore) {
      filter['described.score.total'] = { $lt: Number.parseInt(String(parameters.maxDescribedScore), 10) }
    }
    return filter
  }

  getCoordinatesKey(): string {
    return '_id'
  }

  _buildSort(parameters: MongoDefinitionQuery): Record<string, number> {
    const sort = sortOptions[parameters.sort || ''] || []
    const clause: Record<string, number> = {}
    const sortDirection = parameters.sortDesc ? -1 : 1
    for (const item of sort) {
      clause[item] = sortDirection
    }
    //Always sort on coordinatesKey(_id or partitionKey) for continuation token
    const coordinateKey = this.getCoordinatesKey()
    clause[coordinateKey] = sortDirection
    return clause
  }

  _buildQueryWithPaging(
    query: MongoDefinitionQuery,
    continuationToken: string,
    sort: Record<string, number>
  ): Record<string, any> {
    const filter = this.buildQuery(query)
    const paginationFilter = this._buildPaginationQuery(continuationToken, sort)
    return paginationFilter ? { $and: [filter, paginationFilter] } : filter
  }

  _buildPaginationQuery(continuationToken: string, sort: Record<string, number>): Record<string, any> | undefined {
    if (!continuationToken.length) {
      return undefined
    }
    const queryExpressions = this._buildQueryExpressions(continuationToken, sort)
    return queryExpressions.length <= 1 ? queryExpressions[0] : { $or: [...queryExpressions] }
  }

  _buildQueryExpressions(continuationToken: string, sort: Record<string, number>): Record<string, any>[] {
    const lastValues = base64.decode(continuationToken)
    const sortValues = lastValues.split(SEPARATOR).map(value => (value.length ? value : null))

    const queryExpressions: Record<string, any>[] = []
    const sortConditions = Object.entries(sort)
    for (let nSorts = 1; nSorts <= sortConditions.length; nSorts++) {
      const subList = sortConditions.slice(0, nSorts)
      queryExpressions.push(this._buildQueryExpression(subList, sortValues))
    }
    return queryExpressions
  }

  _buildQueryExpression(sortConditions: [string, number][], sortValues: (string | null)[]): Record<string, any> {
    return sortConditions.reduce(
      (filter, [sortField, sortDirection], index) => {
        const transform = valueTransformers[sortField]
        let sortValue: string | number | null | undefined = sortValues[index]
        sortValue = transform ? transform(sortValue) : sortValue
        const isLast = index === sortConditions.length - 1
        const filterForSort = this._buildQueryForSort(isLast, sortField, sortValue, sortDirection)
        return Object.assign(filter, filterForSort)
      },
      {} as Record<string, any>
    )
  }

  _buildQueryForSort(
    isTieBreaker: boolean,
    sortField: string,
    sortValue: string | number | null | undefined,
    sortDirection: number
  ): Record<string, any> {
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

  _getContinuationToken(pageSize: number, data: any[], sortClause: Record<string, number>): string {
    if (data.length !== pageSize) {
      return ''
    }
    const lastItem = data[data.length - 1]
    const lastValues = Object.keys(sortClause)
      .map(key => get(lastItem, key))
      .join(SEPARATOR)
    return base64.encode(lastValues)
  }
}
export default AbstractMongoDefinitionStore
