// (c) Copyright 2025, Microsoft Corporation and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Logger } from '../../providers/logging'

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
}
