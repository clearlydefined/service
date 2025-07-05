// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { BaseCacheOptions, ICache } from '.'

/** Configuration options for MemoryCache */
export interface MemoryCacheOptions extends BaseCacheOptions {}

/** In-memory cache implementation */
export declare class MemoryCache implements ICache {
  /** The underlying memory cache instance */
  private cache: any

  /** Default TTL in seconds for cached items */
  private defaultTtlSeconds: number

  /**
   * Creates a new MemoryCache instance
   *
   * @param options - Configuration options for the cache
   */
  constructor(options: MemoryCacheOptions)

  /**
   * Initializes the cache (async for interface compatibility)
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
  get(item: string): any

  /**
   * Stores an item in the cache
   *
   * @param item - The key to store the value under
   * @param value - The value to cache
   * @param ttlSeconds - Time-to-live in seconds (optional, uses default if not provided)
   */
  set(item: string, value: any, ttlSeconds?: number): void

  /**
   * Removes an item from the cache
   *
   * @param item - The key of the item to remove
   */
  delete(item: string): void
}

/**
 * Factory function to create a new MemoryCache instance
 *
 * @param options - Configuration options for the cache
 * @returns A new MemoryCache instance
 */
declare function createMemoryCache(options?: MemoryCacheOptions): MemoryCache

export default createMemoryCache
export = createMemoryCache
