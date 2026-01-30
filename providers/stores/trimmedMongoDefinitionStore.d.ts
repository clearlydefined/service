// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { UpdateResult } from 'mongodb'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { FindResult, MongoDefinitionQuery, MongoDefinitionStoreOptions } from './abstractMongoDefinitionStore'
import AbstractMongoDefinitionStore = require('./abstractMongoDefinitionStore')

/** Trimmed definition object (without files) */
export interface TrimmedDefinition {
  /** The coordinates identifying this definition */
  coordinates: EntityCoordinates
  /** Internal MongoDB ID (set during store) */
  _id?: string
  [key: string]: any
}

/**
 * MongoDB implementation for storing trimmed component definitions.
 * Stores definitions without file data for faster queries and smaller storage.
 * Does not support get or list operations - use for find queries only.
 */
declare class TrimmedMongoDefinitionStore extends AbstractMongoDefinitionStore {
  /**
   * List operation is not supported by this store.
   *
   * @param coordinates - Ignored
   * @returns null
   */
  list(coordinates: EntityCoordinates): Promise<null>

  /**
   * Get operation is not supported by this store.
   *
   * @param coordinates - Ignored
   * @returns null
   */
  get(coordinates: EntityCoordinates): Promise<null>

  /**
   * Query and return the objects based on the query.
   * Returns definitions without _id field.
   *
   * @param query - The filters and sorts for the request
   * @param continuationToken - Token for pagination
   * @param pageSize - Number of results per page
   * @returns The data and continuationToken if there are more results
   */
  find(query: MongoDefinitionQuery, continuationToken?: string, pageSize?: number): Promise<FindResult>

  /**
   * Store a trimmed definition in MongoDB.
   * Removes files from the definition before storing.
   *
   * @param definition - The definition to store (files will be removed)
   * @returns Result of the replace operation
   */
  store(definition: TrimmedDefinition): Promise<UpdateResult>

  /**
   * Delete a definition from MongoDB.
   *
   * @param coordinates - The coordinates of the definition to delete
   * @returns null
   */
  delete(coordinates: EntityCoordinates): Promise<null>

  /**
   * Gets the key field used for coordinates.
   *
   * @returns '_id'
   */
  getCoordinatesKey(): string
}

/**
 * Factory function to create a TrimmedMongoDefinitionStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new TrimmedMongoDefinitionStore instance
 */
declare function createTrimmedMongoDefinitionStore(options: MongoDefinitionStoreOptions): TrimmedMongoDefinitionStore

export = createTrimmedMongoDefinitionStore
