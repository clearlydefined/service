// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Collection, Db, Document, Filter, MongoClient, Sort } from 'mongodb'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { Logger } from '../logging'

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

/**
 * Abstract base class for MongoDB-based definition store implementations.
 * Provides common functionality for querying and storing definitions in MongoDB.
 */
export declare class AbstractMongoDefinitionStore {
  /** Configuration options for the store */
  protected options: MongoDefinitionStoreOptions

  /** Logger instance for the store */
  protected logger: Logger

  /** MongoDB client instance */
  protected client: MongoClient

  /** MongoDB database instance */
  protected db: Db

  /** MongoDB collection instance */
  protected collection: Collection

  /**
   * Creates a new AbstractMongoDefinitionStore instance
   *
   * @param options - Configuration options for the store
   */
  constructor(options: MongoDefinitionStoreOptions)

  /**
   * Initializes the MongoDB connection and creates indexes
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>

  /**
   * Creates indexes for the collection (called during initialization)
   */
  protected _createIndexes(): void

  /**
   * Closes the MongoDB connection
   *
   * @returns Promise that resolves when the connection is closed
   */
  close(): Promise<void>

  /**
   * List all of the matching components for the given coordinates.
   * Must be implemented by subclasses.
   *
   * @param coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates
   * @throws Error if not implemented
   */
  list(coordinates: EntityCoordinates): Promise<string[]>

  /**
   * Get and return the object at the given coordinates.
   * Must be implemented by subclasses.
   *
   * @param coordinates - The coordinates of the object to get
   * @returns The loaded object or null if not found
   * @throws Error if not implemented
   */
  get(coordinates: EntityCoordinates): Promise<any>

  /**
   * Query and return the objects based on the query
   *
   * @param query - The filters and sorts for the request
   * @param continuationToken - Token for pagination
   * @param pageSize - Number of results per page
   * @param projection - Optional projection for returned documents
   * @returns The data and continuationToken if there are more results
   */
  find(
    query: MongoDefinitionQuery,
    continuationToken?: string,
    pageSize?: number,
    projection?: Document
  ): Promise<FindResult>

  /**
   * Store a definition. Must be implemented by subclasses.
   *
   * @param definition - The definition to store
   * @throws Error if not implemented
   */
  store(definition: any): Promise<void>

  /**
   * Delete a definition. Must be implemented by subclasses.
   *
   * @param coordinates - The coordinates of the definition to delete
   * @throws Error if not implemented
   */
  delete(coordinates: EntityCoordinates): Promise<void>

  /**
   * Gets the ID string from coordinates
   *
   * @param coordinates - The coordinates
   * @returns The ID string (lowercased coordinate string)
   */
  getId(coordinates: EntityCoordinates | null | undefined): string

  /**
   * Builds a MongoDB filter from query parameters
   *
   * @param parameters - The query parameters
   * @returns The MongoDB filter object
   */
  buildQuery(parameters: MongoDefinitionQuery): Filter<Document>

  /**
   * Gets the key field used for coordinates (to be overridden by subclasses)
   *
   * @returns The coordinates key field name
   */
  getCoordinatesKey(): string

  /**
   * Builds a sort clause from query parameters
   *
   * @param parameters - The query parameters
   * @returns The MongoDB sort object
   */
  protected _buildSort(parameters: MongoDefinitionQuery): Sort

  /**
   * Builds a query with pagination filters
   *
   * @param query - The query parameters
   * @param continuationToken - The continuation token
   * @param sort - The sort clause
   * @returns The combined filter with pagination
   */
  protected _buildQueryWithPaging(query: MongoDefinitionQuery, continuationToken: string, sort: Sort): Filter<Document>

  /**
   * Builds pagination query from continuation token
   *
   * @param continuationToken - The continuation token
   * @param sort - The sort clause
   * @returns The pagination filter or undefined
   */
  protected _buildPaginationQuery(continuationToken: string, sort: Sort): Filter<Document> | undefined

  /**
   * Builds query expressions for pagination
   *
   * @param continuationToken - The continuation token
   * @param sort - The sort clause
   * @returns Array of filter expressions
   */
  protected _buildQueryExpressions(continuationToken: string, sort: Sort): Filter<Document>[]

  /**
   * Builds a single query expression for pagination
   *
   * @param sortConditions - The sort conditions
   * @param sortValues - The values from the continuation token
   * @returns The filter expression
   */
  protected _buildQueryExpression(sortConditions: [string, number][], sortValues: (string | null)[]): Filter<Document>

  /**
   * Builds a filter for a single sort field
   *
   * @param isTieBreaker - Whether this is the tie-breaker field
   * @param sortField - The field name
   * @param sortValue - The value to compare against
   * @param sortDirection - The sort direction (1 or -1)
   * @returns The filter for this sort field
   */
  protected _buildQueryForSort(
    isTieBreaker: boolean,
    sortField: string,
    sortValue: string | number | null,
    sortDirection: number
  ): Filter<Document>

  /**
   * Gets the continuation token for the next page
   *
   * @param pageSize - The page size
   * @param data - The current page data
   * @param sortClause - The sort clause
   * @returns The continuation token or empty string if no more pages
   */
  protected _getContinuationToken(pageSize: number, data: any[], sortClause: Sort): string
}

export default AbstractMongoDefinitionStore
