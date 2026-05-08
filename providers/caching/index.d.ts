// (c) Copyright 2025, Microsoft Corporation and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../../providers/logging/index.ts'

/** Base configuration options common to all cache implementations */
export interface BaseCacheOptions {
  /** Optional logger instance for logging cache operations */
  logger?: Logger
  /** Default time-to-live in seconds for cached items */
  defaultTtlSeconds?: number
}

/** Generic cache interface that all cache implementations should follow */
export interface ICache {
  /**
   * Initializes the cache
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>

  /**
   * Cleanup method called when cache is no longer needed
   *
   * @returns Promise that resolves when cleanup is complete
   */
  done(): Promise<void>

  /**
   * Retrieves an item from the cache
   *
   * @param item - The key of the item to retrieve
   * @returns The cached value or null if not found or expired
   */
  get(item: string): Promise<any> | any

  /**
   * Stores an item in the cache
   *
   * @param item - The key to store the value under
   * @param value - The value to cache
   * @param ttlSeconds - Time-to-live in seconds (optional)
   */
  set(item: string, value: any, ttlSeconds?: number): Promise<void> | void

  /**
   * Removes an item from the cache
   *
   * @param item - The key of the item to remove
   */
  delete(item: string): Promise<void> | void

  /**
   * Atomically sets an item only when the key is absent.
   *
   * @param item - The key to set
   * @param value - The string value to store
   * @param ttlSeconds - Time-to-live in seconds
   * @returns true when set succeeds, false when key already exists
   */
  setIfAbsent(item: string, value: string, ttlSeconds: number): Promise<boolean> | boolean

  /**
   * Atomically acquires all keys in a single operation. If any key is already held,
   * all previously acquired keys in this call are released before returning false.
   *
   * @param keys - The keys to acquire
   * @param value - The string value to store for each key
   * @param ttlSeconds - Time-to-live in seconds for each key
   * @returns true when all keys were acquired, false when any key was already held
   */
  setIfAbsentBatch(keys: string[], value: string, ttlSeconds: number): Promise<boolean> | boolean
}

/**
 * Synchronous cache interface for use cases where get/set must be atomic within
 * a single event loop turn (e.g. dedup checks before an async operation).
 */
export interface ISyncCache<ValueType> {
  /** Retrieves an item synchronously. Returns null if not found or expired. */
  get(item: string): ValueType | null

  /** Stores an item synchronously with an optional TTL in seconds. */
  set(item: string, value: ValueType, ttlSeconds?: number): undefined

  /** Removes an item synchronously. */
  delete(item: string): undefined
}
