// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type {
  Definition,
  DefinitionFindQuery,
  DefinitionFindResult,
  DefinitionStore
} from '../../business/definitionService.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'

/** Options for configuring a DispatchDefinitionStore */
export interface DispatchDefinitionStoreOptions {
  /** Array of definition stores to dispatch operations to */
  stores: DefinitionStore[]
  /** Optional logger instance */
  logger?: Logger
}

/**
 * A definition store that dispatches operations to multiple underlying stores.
 * Sequential operations (get, list, find) return the first successful result.
 * Parallel operations (initialize, store, delete) run on all stores concurrently.
 */
export class DispatchDefinitionStore implements DefinitionStore {
  stores: DefinitionStore[]
  logger: Logger

  constructor(options: DispatchDefinitionStoreOptions) {
    this.stores = options.stores
    this.logger = options.logger || logger()
  }

  /**
   * Initialize all underlying stores in parallel.
   */
  initialize(): Promise<void> {
    return this._performInParallel(store => store.initialize()) as Promise<void>
  }

  /**
   * Get a definition from the first store that has it.
   */
  get(coordinates: EntityCoordinates): Promise<Definition | null> {
    return this._performInSequence(store => store.get(coordinates))
  }

  /**
   * List definitions from the first store that returns results.
   */
  list(coordinates: EntityCoordinates): Promise<string[] | null> {
    return this._performInSequence(store => store.list(coordinates))
  }

  /**
   * Store a definition to all underlying stores in parallel.
   */
  store(definition: Definition) {
    return this._performInParallel(store => store.store(definition))
  }

  /**
   * Delete a definition from all underlying stores in parallel.
   */
  delete(coordinates: EntityCoordinates) {
    return this._performInParallel(store => store.delete(coordinates))
  }

  /**
   * Find definitions from the first store that returns results.
   */
  find(query: DefinitionFindQuery, continuationToken = ''): Promise<DefinitionFindResult> {
    return this._performInSequence(store => store.find(query, continuationToken))
  }

  async _performInSequence<T>(operation: (store: DefinitionStore) => Promise<T>, first = true): Promise<T | null> {
    let result = null
    for (let i = 0; i < this.stores.length; i++) {
      const store = this.stores[i]
      try {
        const opResult = await operation(store)
        result = result || opResult
        if (result && first) {
          return result
        }
      } catch (error) {
        this.logger.error('DispatchDefinitionStore failure', error)
      }
    }
    return result
  }

  async _performInParallel<T>(operation: (store: DefinitionStore) => Promise<T>): Promise<T | undefined> {
    const opPromises = this.stores.map(store => operation(store))
    const results = await Promise.allSettled(opPromises)
    for (const result of results.filter(result => result.status === 'rejected')) {
      this.logger.error('DispatchDefinitionStore failure', result.reason)
    }
    const fulfilled = results.find(result => result.status === 'fulfilled')
    return fulfilled?.value
  }
}

/**
 * Factory function to create a DispatchDefinitionStore instance.
 */
export default (options: DispatchDefinitionStoreOptions): DispatchDefinitionStore =>
  new DispatchDefinitionStore(options)
