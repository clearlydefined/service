// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('mongodb').Document} Document
 * @typedef {import('mongodb').Filter<Document>} Filter
 * @typedef {import('mongodb').InsertManyResult} InsertManyResult
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./abstractMongoDefinitionStore').FindResult} FindResult
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionQuery} MongoDefinitionQuery
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionStoreOptions} MongoDefinitionStoreOptions
 * @typedef {import('./mongo').Definition} Definition
 */

const { clone, get, range } = require('lodash')
const AbstractMongoDefinitionStore = require('./abstractMongoDefinitionStore')
const { escapeRegExp } = require('lodash')

/**
 * MongoDB implementation for storing component definitions with pagination support.
 * Stores large definitions across multiple pages to handle MongoDB document size limits.
 */
class MongoStore extends AbstractMongoDefinitionStore {
  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @override
   * @param {EntityCoordinates} coordinates
   * @returns {Promise<string[]>} A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
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
   *
   * @override
   * @param {EntityCoordinates} coordinates - The coordinates of the object to get
   * @returns {Promise<Definition | undefined>} The loaded object or undefined if not found
   */
  async get(coordinates) {
    const cursor = await this.collection.find(
      { '_mongo.partitionKey': this.getId(coordinates) },
      { projection: { _id: 0, _mongo: 0 }, sort: { '_mongo.page': 1 } }
    )
    /** @type {Definition | undefined} */
    let definition
    await cursor.forEach(
      /** @param {any} page */ page => {
        if (!definition) definition = page
        else definition.files = definition.files.concat(page['files'])
      }
    )
    return definition
  }

  /**
   * Query and return the objects based on the query.
   * Returns definitions without file data and internal MongoDB fields.
   *
   * @override
   * @param {MongoDefinitionQuery} query - The filters and sorts for the request
   * @param {string} [continuationToken=''] - Token for pagination
   * @param {number} [pageSize=100] - Number of results per page
   * @returns {Promise<FindResult>} The data and continuationToken if there are more results
   */
  async find(query, continuationToken = '', pageSize = 100) {
    const projection = { _id: 0, files: 0 }
    const result = await super.find(query, continuationToken, pageSize, projection)
    result.data.forEach(def => {
      delete def._mongo
    })
    return result
  }

  /**
   * Store a definition in MongoDB.
   * Large definitions are automatically paginated.
   *
   * @override
   * @param {Definition} definition - The definition to store
   * @returns {Promise<InsertManyResult>} Result of the insert operation
   */
  // @ts-expect-error - Returns InsertManyResult instead of void
  async store(definition) {
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

  /**
   * Delete a definition from MongoDB.
   * Removes all pages of the definition.
   *
   * @override
   * @param {EntityCoordinates} coordinates - The coordinates of the definition to delete
   * @returns {Promise<null>} null
   */
  async delete(coordinates) {
    await this.collection.deleteMany({ '_mongo.partitionKey': this.getId(coordinates) })
    return null
  }

  /**
   * Gets the key field used for coordinates.
   *
   * @override
   * @returns {string} '_mongo.partitionKey'
   */
  getCoordinatesKey() {
    return '_mongo.partitionKey'
  }

  /**
   * Builds a MongoDB filter from query parameters.
   * Adds page filter to only return first page of each definition.
   *
   * @override
   * @param {MongoDefinitionQuery} parameters - The query parameters
   * @returns {Filter} The MongoDB filter object
   */
  buildQuery(parameters) {
    const filter = super.buildQuery(parameters)
    return { ...filter, '_mongo.page': 1 } // only get page 1 of each definition
  }
}

/**
 * Factory function to create a MongoStore instance.
 *
 * @param {MongoDefinitionStoreOptions} options - Configuration options for the store
 * @returns {MongoStore} A new MongoStore instance
 */
module.exports = options => new MongoStore(options)
