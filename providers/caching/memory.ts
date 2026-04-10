// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Cache } from 'memory-cache'

import type { BaseCacheOptions, ICache } from './index.js'

/** Configuration options for MemoryCache */
export interface MemoryCacheOptions extends BaseCacheOptions {}

/** In-memory cache implementation using memory-cache library */
class MemoryCache implements ICache {
  private declare cache: any
  private declare defaultTtlSeconds: number | undefined

  /** Creates a new MemoryCache instance */
  constructor(options: MemoryCacheOptions) {
    this.cache = new Cache()
    this.defaultTtlSeconds = options.defaultTtlSeconds
  }

  /** Initializes the cache (async for interface compatibility) */
  async initialize(): Promise<void> {}

  /** Cleanup method called when cache is no longer needed */
  async done(): Promise<void> {}

  /** Retrieves an item from the cache */
  get(item: string): any {
    return this.cache.get(item)
  }

  /** Stores an item in the cache */
  set(item: string, value: any, ttlSeconds: number | null = null): void {
    const expiration = 1000 * (ttlSeconds || this.defaultTtlSeconds || 0)
    this.cache.put(item, value, expiration)
  }

  /** Removes an item from the cache */
  delete(item: string): void {
    this.cache.del(item)
  }
}

/** Factory function to create a new MemoryCache instance */
export default (options?: MemoryCacheOptions): MemoryCache => new MemoryCache(options || { defaultTtlSeconds: 60 * 60 })
