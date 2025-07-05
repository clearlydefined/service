// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { RedisClientType } from 'redis'
import { BaseCacheOptions, ICache } from '.'
import { Logger } from '../logging'

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

/** Redis-based cache implementation with compression */
declare class RedisCache implements ICache {
  /** Configuration options for the cache */
  private options: RedisCacheOptions

  /** Logger instance for cache operations */
  private logger: Logger

  /** The Redis client instance */
  private _client: RedisClientType | null

  /** Promise for client initialization to prevent multiple concurrent initializations */
  private _clientReady: Promise<void> | null

  /**
   * Creates a new RedisCache instance
   *
   * @param options - Configuration options for the Redis connection
   */
  constructor(options: RedisCacheOptions)

  /**
   * Initializes the Redis client connection This method is idempotent - multiple calls will not create multiple
   * connections
   *
   * @returns Promise that resolves when the connection is established
   * @throws Will throw an error if the Redis connection fails
   */
  initialize(): Promise<void>

  /**
   * Closes the Redis connection and cleans up resources
   *
   * @returns Promise that resolves when the connection is closed
   */
  done(): Promise<void>

  /**
   * Gets the underlying Redis client instance
   *
   * @returns The Redis client or null if not initialized
   */
  get client(): RedisClientType | null

  /**
   * Retrieves an item from the Redis cache Items are automatically decompressed and deserialized
   *
   * @param item - The key of the item to retrieve
   * @returns The cached value or null if not found
   * @throws Will log errors but return null for parsing failures
   */
  get(item: string): Promise<any>

  /**
   * Stores an item in the Redis cache Items are automatically serialized and compressed
   *
   * @param item - The key to store the value under
   * @param value - The value to cache (any serializable type)
   * @param ttlSeconds - Optional time-to-live in seconds
   * @returns Promise that resolves when the item is stored
   */
  set(item: string, value: any, ttlSeconds?: number): Promise<void>

  /**
   * Removes an item from the Redis cache
   *
   * @param item - The key of the item to remove
   * @returns Promise that resolves when the item is removed
   */
  delete(item: string): Promise<void>

  /**
   * Creates a configured Redis client instance
   *
   * @param options - Redis connection configuration
   * @returns A new Redis client instance
   */
  static buildRedisClient(options: RedisCacheOptions): RedisClientType

  /**
   * Initializes a Redis client with connection and error handling
   *
   * @param options - Redis connection configuration
   * @param logger - Logger instance for connection events
   * @returns Promise that resolves to the connected Redis client
   * @throws Will throw an error if the connection fails
   */
  static initializeClient(options: RedisCacheOptions, logger: Logger): Promise<RedisClientType>
}

/**
 * Factory function to create a new RedisCache instance
 *
 * @param options - Configuration options for the Redis connection
 * @returns A new RedisCache instance
 */
declare function createRedisCache(options: RedisCacheOptions): RedisCache

declare namespace createRedisCache {
  export { RedisCache }
}

export = createRedisCache
export { RedisCacheOptions }
