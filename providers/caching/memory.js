// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Cache = require('memory-cache').Cache

/** @typedef {import('./memory').MemoryCacheOptions} MemoryCacheOptions */

/** In-memory cache implementation using memory-cache library */
class MemoryCache {
  /**
   * Creates a new MemoryCache instance
   *
   * @param {MemoryCacheOptions} options - Configuration options for the cache
   */
  constructor(options) {
    /** @private */
    this.cache = new Cache()
    /** @private */
    this.defaultTtlSeconds = options.defaultTtlSeconds
  }

  /**
   * Initializes the cache (async for interface compatibility)
   *
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async initialize() {}

  /**
   * Cleanup method called when cache is no longer needed
   *
   * @returns {Promise<void>} Promise that resolves when cleanup is complete
   */
  async done() {}

  /**
   * Retrieves an item from the cache
   *
   * @param {string} item - The key of the item to retrieve
   * @returns {any} The cached value or null if not found or expired
   */
  get(item) {
    return this.cache.get(item)
  }

  /**
   * Stores an item in the cache
   *
   * @param {string} item - The key to store the value under
   * @param {any} value - The value to cache
   * @param {number | null} [ttlSeconds=null] - Time-to-live in seconds (optional, uses default if not provided).
   *   Default is `null`
   */
  set(item, value, ttlSeconds = null) {
    const expiration = 1000 * (ttlSeconds || this.defaultTtlSeconds)
    this.cache.put(item, value, expiration)
  }

  /**
   * Removes an item from the cache
   *
   * @param {string} item - The key of the item to remove
   */
  delete(item) {
    this.cache.del(item)
  }
}

/**
 * Factory function to create a new MemoryCache instance
 *
 * @param {MemoryCacheOptions} [options] - Configuration options for the cache
 * @returns {MemoryCache} A new MemoryCache instance
 */
module.exports = options => new MemoryCache(options || { defaultTtlSeconds: 60 * 60 })
