// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Document, Filter, InsertManyResult } from 'mongodb'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { FindResult, MongoDefinitionQuery, MongoDefinitionStoreOptions } from './abstractMongoDefinitionStore'
import AbstractMongoDefinitionStore = require('./abstractMongoDefinitionStore')

/** Definition object with coordinates and files */
export interface Definition {
  /** The coordinates identifying this definition */
  coordinates: EntityCoordinates
  /** File information for the definition */
  files?: any[]
  /** Internal MongoDB ID (set during store) */
  _id?: string
  [key: string]: any
}

/**
 * MongoDB implementation for storing component definitions with pagination support.
 * Stores large definitions across multiple pages to handle MongoDB document size limits.
 */
declare class MongoStore extends AbstractMongoDefinitionStore {
  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param coordinates - The coordinates to search for
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  list(coordinates: EntityCoordinates): Promise<string[]>

  /**
   * Get and return the object at the given coordinates.
   * Reassembles paginated definitions automatically.
   *
   * @param coordinates - The coordinates of the object to get
   * @returns The loaded object or undefined if not found
   */
  get(coordinates: EntityCoordinates): Promise<Definition | undefined>

  /**
   * Query and return the objects based on the query.
   * Returns definitions without file data and internal MongoDB fields.
   *
   * @param query - The filters and sorts for the request
   * @param continuationToken - Token for pagination
   * @param pageSize - Number of results per page (default: 100)
   * @returns The data and continuationToken if there are more results
   */
  find(query: MongoDefinitionQuery, continuationToken?: string, pageSize?: number): Promise<FindResult>

  /**
   * Store a definition in MongoDB.
   * Large definitions are automatically paginated.
   *
   * @param definition - The definition to store
   * @returns Result of the insert operation
   */
  store(definition: Definition): Promise<InsertManyResult>

  /**
   * Delete a definition from MongoDB.
   * Removes all pages of the definition.
   *
   * @param coordinates - The coordinates of the definition to delete
   * @returns null
   */
  delete(coordinates: EntityCoordinates): Promise<null>

  /**
   * Gets the key field used for coordinates.
   *
   * @returns '_mongo.partitionKey'
   */
  getCoordinatesKey(): string

  /**
   * Builds a MongoDB filter from query parameters.
   * Adds page filter to only return first page of each definition.
   *
   * @param parameters - The query parameters
   * @returns The MongoDB filter object
   */
  buildQuery(parameters: MongoDefinitionQuery): Filter<Document>
}

/**
 * Factory function to create a MongoStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new MongoStore instance
 */
declare function createMongoStore(options: MongoDefinitionStoreOptions): MongoStore

export = createMongoStore
