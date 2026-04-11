// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import pako from 'pako'
import type { RedisClientOptions, RedisClientType } from 'redis'
import { createClient } from 'redis'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { BaseCacheOptions, ICache } from './index.js'

type RedisSocketOptions = RedisClientOptions['socket']

/** Configuration options for Redis cache connection */
export interface RedisCacheOptions extends BaseCacheOptions {
  /** Redis API key/password for authentication */
  apiKey?: string
  /** Redis server hostname or IP address */
  service: string
  /** Redis server port number (defaults to 6380) */
  port?: number
  /** Whether to use TLS encryption (defaults to true) */
  tls?: boolean
}

/** Prefix used to identify serialized objects in cache */
const objectPrefix = '*!~%'

/**
 * Redis-based cache implementation with compression support
 *
 * This class provides a caching interface using Redis as the backing store. All cached values are compressed using pako
 * (zlib) to reduce memory usage. Objects are automatically serialized as JSON with a special prefix.
 */
class RedisCache implements ICache {
  private declare options: RedisCacheOptions
  private declare logger: Logger
  private declare _client: RedisClientType | null
  private declare _clientReady: Promise<void> | null

  /** Creates a new RedisCache instance */
  constructor(options: RedisCacheOptions) {
    this.options = options
    this.logger = options.logger || logger()
  }

  /**
   * Initializes the Redis client connection. This method is idempotent - multiple calls will not create multiple
   * connections.
   *
   * @throws {Error} Will throw an error if the Redis connection fails
   */
  async initialize(): Promise<void> {
    if (this._client) {
      return Promise.resolve()
    }
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

  /** Closes the Redis connection and cleans up resources */
  async done(): Promise<void> {
    const client = this._client
    this._client = null
    await client?.quit()
  }

  /** Gets the underlying Redis client instance */
  get client(): RedisClientType | null {
    return this._client
  }

  /** Retrieves an item from the Redis cache. Items are automatically decompressed and deserialized. */
  async get(item: string): Promise<any> {
    const cacheItem = await this._client!.get(item)
    if (!cacheItem) {
      return null
    }

    let result
    try {
      // Ensure cacheItem is treated as a string
      const dataString = typeof cacheItem === 'string' ? cacheItem : String(cacheItem)

      // Detect format: base64 (new) vs binary string (old)
      // Base64 only contains A-Z, a-z, 0-9, +, /, and optional = padding
      const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(dataString)

      let buffer
      if (isBase64) {
        // NEW format: base64 encoded (written by Pako 2.1.0)
        buffer = Buffer.from(dataString, 'base64')
      } else {
        // OLD format: binary string (written by Pako 1.0.8 with { to: 'string' })
        // Use 'binary' encoding to preserve byte values
        buffer = Buffer.from(dataString, 'binary')
      }

      result = pako.inflate(buffer, { to: 'string' })
    } catch (err) {
      // Disregard decompression errors gracefully as cache may be stored in an older format, missing or expired.
      this.logger.debug(`Failed to fetch cache item: ${item}`, err)
      return null
    }

    if (!result.startsWith(objectPrefix)) {
      return result
    }
    try {
      return JSON.parse(result.substring(4))
    } catch (error) {
      this.logger.error(`Error parsing cached item: ${error}`)
      return null
    }
  }

  /** Stores an item in the Redis cache. Items are automatically serialized and compressed. */
  async set(item: string, value: any, ttlSeconds?: number): Promise<void> {
    if (typeof value !== 'string') {
      value = objectPrefix + JSON.stringify(value)
    }
    const deflated = pako.deflate(value)
    const data = Buffer.from(deflated).toString('base64')
    if (ttlSeconds) {
      await this._client!.set(item, data, { EX: ttlSeconds })
    } else {
      await this._client!.set(item, data)
    }
  }

  /** Removes an item from the Redis cache */
  async delete(item: string): Promise<void> {
    await this._client!.del(item)
  }

  /** Creates a configured Redis client instance */
  static buildRedisClient({ apiKey, service, port = 6380, tls = true }: RedisCacheOptions): RedisClientType {
    let socketOptions: RedisSocketOptions

    if (tls === true) {
      socketOptions = {
        host: service,
        port,
        tls
      }
    } else {
      socketOptions = {
        host: service,
        port
      }
    }
    return createClient({
      username: 'default',
      password: apiKey,
      socket: socketOptions,
      pingInterval: 5 * 60 * 1000 // https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices-connection#idle-timeout
    })
  }

  /**
   * Initializes a Redis client with connection and error handling.
   *
   * @throws {Error} Will throw an error if the connection fails
   */
  static async initializeClient(options: RedisCacheOptions, logger: Logger): Promise<RedisClientType> {
    const client = RedisCache.buildRedisClient(options)
    try {
      await client.connect()
      logger.info('Connected to redis', { service: options.service })
      client.on('error', error => {
        logger.error(`Redis client error: ${error}`)
      })
      return client
    } catch (error) {
      logger.error(`Error connecting to redis: ${error}`)
      throw error
    }
  }
}

/** Factory function to create a new RedisCache instance */
export default (options: RedisCacheOptions): RedisCache => new RedisCache(options)
export { RedisCache }
