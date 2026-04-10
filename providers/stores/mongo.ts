// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { Document, Filter, InsertManyResult } from 'mongodb'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { FindResult, MongoDefinitionQuery, MongoDefinitionStoreOptions } from './abstractMongoDefinitionStore.ts'

const { clone, get, range, escapeRegExp } = lodash

import AbstractMongoDefinitionStore from './abstractMongoDefinitionStore.ts'

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
export class MongoStore extends AbstractMongoDefinitionStore {
  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   */
  override async list(coordinates: EntityCoordinates): Promise<string[]> {
    const id = escapeRegExp(this.getId(coordinates))
    const list = await this.collection.find(
      { '_mongo.partitionKey': new RegExp(`^${id}`), '_mongo.page': 1 },
      { projection: { _id: 1 } }
    )

    return (await list.toArray()).map(entry => String(entry._id))
  }

  /**
   * Get and return the object at the given coordinates.
   * Reassembles paginated definitions automatically.
   */
  override async get(coordinates: EntityCoordinates): Promise<Definition | undefined> {
    const cursor = await this.collection.find(
      { '_mongo.partitionKey': this.getId(coordinates) },
      { projection: { _id: 0, _mongo: 0 }, sort: { '_mongo.page': 1 } }
    )
    let definition: Definition | undefined
    for await (const page of cursor as AsyncIterable<any>) {
      if (!definition) {
        definition = page
      } else {
        definition.files = definition.files.concat(page['files'])
      }
    }
    return definition
  }

  /**
   * Query and return the objects based on the query.
   * Returns definitions without file data and internal MongoDB fields.
   */
  override async find(query: MongoDefinitionQuery, continuationToken = '', pageSize = 100): Promise<FindResult> {
    const projection = { _id: 0, files: 0 }
    const result = await super.find(query, continuationToken, pageSize, projection)
    for (const def of result.data) {
      delete def._mongo
    }
    return result
  }

  /**
   * Store a definition in MongoDB.
   * Large definitions are automatically paginated.
   */
  // @ts-expect-error - Returns InsertManyResult instead of void
  override async store(definition: Definition): Promise<InsertManyResult> {
    const pageSize = 1000
    definition._id = this.getId(definition.coordinates)
    await this.collection.deleteMany({ '_mongo.partitionKey': definition._id })
    const pages = Math.ceil((get(definition, 'files.length') || 1) / pageSize)
    const result = await this.collection.insertMany(
      // @ts-expect-error - String _id is valid for MongoDB
      range(pages).map(
        index => {
          if (index === 0) {
            const definitionPage = clone(definition)
            if (definition.files) {
              definitionPage.files = definition.files.slice(0, pageSize)
            }
            return { ...definitionPage, _mongo: { partitionKey: definition._id, page: 1, totalPages: pages } }
          }
          return {
            _id: `${definition._id}/${index}`,
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

  /**
   * Delete a definition from MongoDB.
   * Removes all pages of the definition.
   */
  override async delete(coordinates: EntityCoordinates): Promise<null> {
    await this.collection.deleteMany({ '_mongo.partitionKey': this.getId(coordinates) })
    return null
  }

  /**
   * Gets the key field used for coordinates.
   */
  override getCoordinatesKey(): string {
    return '_mongo.partitionKey'
  }

  /**
   * Builds a MongoDB filter from query parameters.
   * Adds page filter to only return first page of each definition.
   */
  override buildQuery(parameters: MongoDefinitionQuery): Filter<Document> {
    const filter = super.buildQuery(parameters)
    return { ...filter, '_mongo.page': 1 } // only get page 1 of each definition
  }
}

/**
 * Factory function to create a MongoStore instance.
 */
export default (options: MongoDefinitionStoreOptions): MongoStore => new MongoStore(options)
