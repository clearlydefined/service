// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { UpdateResult } from 'mongodb'
import type { DefinitionStore } from '../../business/definitionService.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { FindResult, MongoDefinitionQuery, MongoDefinitionStoreOptions } from './abstractMongoDefinitionStore.ts'
import AbstractMongoDefinitionStore from './abstractMongoDefinitionStore.ts'

const { clone } = lodash

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
export class TrimmedMongoDefinitionStore extends AbstractMongoDefinitionStore implements DefinitionStore {
  /**
   * List operation is not supported by this store.
   */
  // eslint-disable-next-line no-unused-vars
  override async list(_coordinates: EntityCoordinates): Promise<string[]> {
    //This store does not support list for coordinates
    return []
  }

  /**
   * Get operation is not supported by this store.
   */
  // eslint-disable-next-line no-unused-vars
  override async get(_coordinates: EntityCoordinates): Promise<null> {
    //This store does not support get definition
    return null
  }

  /**
   * Query and return the objects based on the query.
   * Returns definitions without _id field.
   */
  override async find(query: MongoDefinitionQuery, continuationToken = '', pageSize?: number): Promise<FindResult> {
    const result = await super.find(query, continuationToken, pageSize)
    for (const def of result.data) {
      delete def._id
    }
    return result
  }

  /**
   * Store a trimmed definition in MongoDB.
   * Removes files from the definition before storing.
   */
  // @ts-expect-error - Returns UpdateResult instead of void
  override async store(definition: TrimmedDefinition): Promise<UpdateResult> {
    const definitionDoc = clone(definition)
    definitionDoc._id = this.getId(definition.coordinates)
    delete definitionDoc['files']
    // @ts-expect-error - String _id is valid for MongoDB
    return await this.collection.replaceOne({ _id: definitionDoc._id }, definitionDoc, { upsert: true })
  }

  /**
   * Delete a definition from MongoDB.
   */
  override async delete(coordinates: EntityCoordinates): Promise<void> {
    // @ts-expect-error - String _id is valid for MongoDB
    await this.collection.deleteOne({ _id: this.getId(coordinates) })
  }

  /**
   * Gets the key field used for coordinates.
   */
  override getCoordinatesKey(): string {
    return '_id'
  }
}

/**
 * Factory function to create a TrimmedMongoDefinitionStore instance.
 */
export default (options: MongoDefinitionStoreOptions): TrimmedMongoDefinitionStore =>
  new TrimmedMongoDefinitionStore(options)
