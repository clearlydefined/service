// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('mongodb').UpdateResult} UpdateResult
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./abstractMongoDefinitionStore').FindResult} FindResult
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionQuery} MongoDefinitionQuery
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionStoreOptions} MongoDefinitionStoreOptions
 * @typedef {import('./trimmedMongoDefinitionStore').TrimmedDefinition} TrimmedDefinition
 */

const AbstractMongoDefinitionStore = require('./abstractMongoDefinitionStore')
const { clone } = require('lodash')

/**
 * MongoDB implementation for storing trimmed component definitions.
 * Stores definitions without file data for faster queries and smaller storage.
 * Does not support get or list operations - use for find queries only.
 */
class TrimmedMongoDefinitionStore extends AbstractMongoDefinitionStore {
  /**
   * List operation is not supported by this store.
   *
   * @override
   * @param {EntityCoordinates} _coordinates - Ignored
   * @returns {Promise<null>} null
   */
  // eslint-disable-next-line no-unused-vars
  async list(_coordinates) {
    //This store does not support list for coordinates
    return null
  }

  /**
   * Get operation is not supported by this store.
   *
   * @override
   * @param {EntityCoordinates} _coordinates - Ignored
   * @returns {Promise<null>} null
   */
  // eslint-disable-next-line no-unused-vars
  async get(_coordinates) {
    //This store does not support get definition
    return null
  }

  /**
   * Query and return the objects based on the query.
   * Returns definitions without _id field.
   *
   * @override
   * @param {MongoDefinitionQuery} query - The filters and sorts for the request
   * @param {string} [continuationToken=''] - Token for pagination
   * @param {number} [pageSize] - Number of results per page
   * @returns {Promise<FindResult>} The data and continuationToken if there are more results
   */
  async find(query, continuationToken = '', pageSize) {
    const result = await super.find(query, continuationToken, pageSize)
    result.data.forEach(def => {
      delete def._id
    })
    return result
  }

  /**
   * Store a trimmed definition in MongoDB.
   * Removes files from the definition before storing.
   *
   * @override
   * @param {TrimmedDefinition} definition - The definition to store (files will be removed)
   * @returns {Promise<UpdateResult>} Result of the replace operation
   */
  // @ts-expect-error - Returns UpdateResult instead of void
  async store(definition) {
    const definitionDoc = clone(definition)
    definitionDoc._id = this.getId(definition.coordinates)
    delete definitionDoc['files']
    // @ts-expect-error - String _id is valid for MongoDB
    return await this.collection.replaceOne({ _id: definitionDoc._id }, definitionDoc, { upsert: true })
  }

  /**
   * Delete a definition from MongoDB.
   *
   * @override
   * @param {EntityCoordinates} coordinates - The coordinates of the definition to delete
   * @returns {Promise<null>} null
   */
  async delete(coordinates) {
    // @ts-expect-error - String _id is valid for MongoDB
    await this.collection.deleteOne({ _id: this.getId(coordinates) })
    return null
  }

  /**
   * Gets the key field used for coordinates.
   *
   * @override
   * @returns {string} '_id'
   */
  getCoordinatesKey() {
    return '_id'
  }
}

/**
 * Factory function to create a TrimmedMongoDefinitionStore instance.
 *
 * @param {MongoDefinitionStoreOptions} options - Configuration options for the store
 * @returns {TrimmedMongoDefinitionStore} A new TrimmedMongoDefinitionStore instance
 */
module.exports = options => new TrimmedMongoDefinitionStore(options)
