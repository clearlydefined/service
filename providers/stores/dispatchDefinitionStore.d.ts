// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { Logger } from '../logging'
import type { FindResult, MongoDefinitionQuery } from './abstractMongoDefinitionStore'

/** Definition object with coordinates */
export interface Definition {
  /** The coordinates identifying this definition */
  coordinates: EntityCoordinates
  [key: string]: any
}

/** Interface for definition stores that can be dispatched to */
export interface DefinitionStore {
  initialize(): Promise<void>
  get(coordinates: EntityCoordinates): Promise<Definition | null>
  list(coordinates: EntityCoordinates): Promise<string[] | null>
  store(definition: Definition): Promise<any>
  delete(coordinates: EntityCoordinates): Promise<any>
  find(query: MongoDefinitionQuery, continuationToken?: string): Promise<FindResult | null>
}

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
declare class DispatchDefinitionStore {
  /** The underlying stores to dispatch to */
  stores: DefinitionStore[]

  /** Logger instance for the store */
  logger: Logger

  /**
   * Creates a new DispatchDefinitionStore instance.
   *
   * @param options - Configuration options for the store
   */
  constructor(options: DispatchDefinitionStoreOptions)

  /**
   * Initialize all underlying stores in parallel.
   *
   * @returns Promise that resolves when all stores are initialized
   */
  initialize(): Promise<void>

  /**
   * Get a definition from the first store that has it.
   *
   * @param coordinates - The coordinates of the definition to get
   * @returns The definition or null if not found
   */
  get(coordinates: EntityCoordinates): Promise<Definition | null>

  /**
   * List definitions from the first store that returns results.
   *
   * @param coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates or null
   */
  list(coordinates: EntityCoordinates): Promise<string[] | null>

  /**
   * Store a definition to all underlying stores in parallel.
   *
   * @param definition - The definition to store
   * @returns Result from the first successful store
   */
  store(definition: Definition): Promise<any>

  /**
   * Delete a definition from all underlying stores in parallel.
   *
   * @param coordinates - The coordinates of the definition to delete
   * @returns Result from the first successful delete
   */
  delete(coordinates: EntityCoordinates): Promise<any>

  /**
   * Find definitions from the first store that returns results.
   *
   * @param query - The query parameters
   * @param continuationToken - Token for pagination
   * @returns The find result or null
   */
  find(query: MongoDefinitionQuery, continuationToken?: string): Promise<FindResult | null>
}

/**
 * Factory function to create a DispatchDefinitionStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new DispatchDefinitionStore instance
 */
declare function createDispatchDefinitionStore(options: DispatchDefinitionStoreOptions): DispatchDefinitionStore

export = createDispatchDefinitionStore
