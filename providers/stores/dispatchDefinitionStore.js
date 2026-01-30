// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('./abstractMongoDefinitionStore').FindResult} FindResult
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionQuery} MongoDefinitionQuery
 * @typedef {import('./dispatchDefinitionStore').Definition} Definition
 * @typedef {import('./dispatchDefinitionStore').DefinitionStore} DefinitionStore
 * @typedef {import('./dispatchDefinitionStore').DispatchDefinitionStoreOptions} DispatchDefinitionStoreOptions
 */

const logger = require('../logging/logger')

/**
 * A definition store that dispatches operations to multiple underlying stores.
 * Sequential operations (get, list, find) return the first successful result.
 * Parallel operations (initialize, store, delete) run on all stores concurrently.
 */
class DispatchDefinitionStore {
  /**
   * Creates a new DispatchDefinitionStore instance.
   *
   * @param {DispatchDefinitionStoreOptions} options - Configuration options for the store
   */
  constructor(options) {
    /** @type {DefinitionStore[]} */
    this.stores = options.stores
    /** @type {Logger} */
    this.logger = options.logger || logger()
  }

  /**
   * Initialize all underlying stores in parallel.
   *
   * @returns {Promise<void>} Promise that resolves when all stores are initialized
   */
  initialize() {
    return this._performInParallel(store => store.initialize())
  }

  /**
   * Get a definition from the first store that has it.
   *
   * @param {EntityCoordinates} coordinates - The coordinates of the definition to get
   * @returns {Promise<Definition | null>} The definition or null if not found
   */
  get(coordinates) {
    return this._performInSequence(store => store.get(coordinates))
  }

  /**
   * List definitions from the first store that returns results.
   *
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates
   * @returns {Promise<string[] | null>} A list of matching coordinates or null
   */
  list(coordinates) {
    return this._performInSequence(store => store.list(coordinates))
  }

  /**
   * Store a definition to all underlying stores in parallel.
   *
   * @param {Definition} definition - The definition to store
   * @returns {Promise<any>} Result from the first successful store
   */
  store(definition) {
    return this._performInParallel(store => store.store(definition))
  }

  /**
   * Delete a definition from all underlying stores in parallel.
   *
   * @param {EntityCoordinates} coordinates - The coordinates of the definition to delete
   * @returns {Promise<any>} Result from the first successful delete
   */
  delete(coordinates) {
    return this._performInParallel(store => store.delete(coordinates))
  }

  /**
   * Find definitions from the first store that returns results.
   *
   * @param {MongoDefinitionQuery} query - The query parameters
   * @param {string} [continuationToken=''] - Token for pagination
   * @returns {Promise<FindResult | null>} The find result or null
   */
  find(query, continuationToken = '') {
    return this._performInSequence(store => store.find(query, continuationToken))
  }

  /**
   * Execute an operation on stores sequentially until one succeeds.
   *
   * @private
   * @template T
   * @param {function(DefinitionStore): Promise<T>} operation - The operation to perform
   * @param {boolean} [first=true] - Whether to return on first result
   * @returns {Promise<T | null>} The first successful result or null
   */
  async _performInSequence(operation, first = true) {
    let result = null
    for (let i = 0; i < this.stores.length; i++) {
      const store = this.stores[i]
      try {
        const opResult = await operation(store)
        result = result || opResult
        if (result && first) return result
      } catch (error) {
        this.logger.error('DispatchDefinitionStore failure', error)
      }
    }
    return result
  }

  /**
   * Execute an operation on all stores in parallel.
   *
   * @private
   * @template T
   * @param {function(DefinitionStore): Promise<T>} operation - The operation to perform
   * @returns {Promise<T | undefined>} Result from the first fulfilled promise
   */
  async _performInParallel(operation) {
    const opPromises = this.stores.map(store => operation(store))
    const results = await Promise.allSettled(opPromises)
    results
      .filter(result => result.status === 'rejected')
      .forEach(result => this.logger.error('DispatchDefinitionStore failure', result.reason))
    const fulfilled = results.find(result => result.status === 'fulfilled')
    return fulfilled?.value
  }
}

/**
 * Factory function to create a DispatchDefinitionStore instance.
 *
 * @param {DispatchDefinitionStoreOptions} options - Configuration options for the store
 * @returns {DispatchDefinitionStore} A new DispatchDefinitionStore instance
 */
module.exports = options => new DispatchDefinitionStore(options)
