// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { createClient } = require('redis')
const pako = require('pako')
const logger = require('../logging/logger')

/**
 * @typedef {import('./redis.d.ts').RedisCacheOptions} RedisCacheOptions
 *
 * @typedef {import('redis').RedisClientType} RedisClientType
 *
 * @typedef {import('../logging').Logger} Logger
 */

/** Prefix used to identify serialized objects in cache */
const objectPrefix = '*!~%'

/**
 * Redis-based cache implementation with compression support
 *
 * This class provides a caching interface using Redis as the backing store. All cached values are compressed using pako
 * (zlib) to reduce memory usage. Objects are automatically serialized as JSON with a special prefix.
 */
class RedisCache {
  /**
   * Creates a new RedisCache instance
   *
   * @param {RedisCacheOptions} options - Configuration options for the Redis connection
   */
  constructor(options) {
    this.options = options
    this.logger = options.logger || logger()
  }

  /**
   * Initializes the Redis client connection This method is idempotent - multiple calls will not create multiple
   * connections
   *
   * @returns {Promise<void>} Promise that resolves when the connection is established
   * @throws {Error} Will throw an error if the Redis connection fails
   */
  async initialize() {
    if (this._client) return Promise.resolve()
    if (!this._clientReady) {
      this._clientReady = RedisCache.initializeClient(this.options, this.logger)
        .then(client => {
          this._client = client
        })
        .catch(error => {
          this._clientReady = null
          throw error
        })
    }
    return this._clientReady
  }

  /**
   * Closes the Redis connection and cleans up resources
   *
   * @returns {Promise<string>} Promise that resolves when the connection is closed
   */
  async done() {
    const client = this._client
    this._client = null
    return client?.quit()
  }

  /**
   * Gets the underlying Redis client instance
   *
   * @returns {RedisClientType} The Redis client or null if not initialized
   */
  get client() {
    return this._client
  }

  /**
   * Retrieves an item from the Redis cache Items are automatically decompressed and deserialized
   *
   * @param {string} item - The key of the item to retrieve
   * @returns {Promise<any>} The cached value or null if not found
   * @throws Will log errors but return null for parsing failures
   */
  async get(item) {
    const cacheItem = await this._client.get(item)
    if (!cacheItem) return null
    const result = pako.inflate(cacheItem, { to: 'string' })
    if (!result.startsWith(objectPrefix)) return result
    try {
      return JSON.parse(result.substring(4))
    } catch (error) {
      this.logger.error('Error parsing cached item: %s', error)
      return null
    }
  }

  /**
   * Stores an item in the Redis cache Items are automatically serialized and compressed
   *
   * @param {string} item - The key to store the value under
   * @param {any} value - The value to cache (any serializable type)
   * @param {number} [ttlSeconds] - Optional time-to-live in seconds
   * @returns {Promise<void>} Promise that resolves when the item is stored
   */
  async set(item, value, ttlSeconds) {
    if (typeof value !== 'string') value = objectPrefix + JSON.stringify(value)
    const data = pako.deflate(value, { to: 'string' })
    if (ttlSeconds) await this._client.set(item, data, { EX: ttlSeconds })
    else await this._client.set(item, data)
  }

  /**
   * Removes an item from the Redis cache
   *
   * @param {string} item - The key of the item to remove
   * @returns {Promise<void>} Promise that resolves when the item is removed
   */
  async delete(item) {
    await this._client.del(item)
  }

  /**
   * Creates a configured Redis client instance
   *
   * @param {RedisCacheOptions} options - Redis connection configuration
   * @returns {RedisClientType} A new Redis client instance
   */
  static buildRedisClient({ apiKey, service, port = 6380, tls = true }) {
    return createClient({
      username: 'default',
      password: apiKey,
      socket: { host: service, port, tls },
      pingInterval: 5 * 60 * 1000 // https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices-connection#idle-timeout
    })
  }

  /**
   * Initializes a Redis client with connection and error handling
   *
   * @param {RedisCacheOptions} options - Redis connection configuration
   * @param {Logger} logger - Logger instance for connection events
   * @returns {Promise<RedisClientType>} Promise that resolves to the connected Redis client
   * @throws {Error} Will throw an error if the connection fails
   */
  static async initializeClient(options, logger) {
    const client = this.buildRedisClient(options)
    try {
      await client.connect()
      logger.info('Done connecting to redis: %s', options.service)
      client.on('error', error => {
        logger.error(`Redis client error: ${error}`)
      })
      return client
    } catch (error) {
      logger.error('Error connecting to redis: %s', error)
      throw error
    }
  }
}

/**
 * Factory function to create a new RedisCache instance
 *
 * @param {RedisCacheOptions} options - Configuration options for the Redis connection
 * @returns {RedisCache} A new RedisCache instance
 */
module.exports = options => new RedisCache(options)
module.exports.RedisCache = RedisCache
