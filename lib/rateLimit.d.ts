// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Request, Response, NextFunction } from 'express'
import { Store } from 'express-rate-limit'
import { RedisClientType } from 'redis'
import { Logger } from '../providers/logging'
import { ICache } from '../providers/caching'

/** Configuration options for rate limiting window and maximum requests */
export interface RateLimitConfig {
  /** Time window in milliseconds for rate limiting */
  windowMs: number
  /** Maximum number of requests allowed within the window */
  max: number
}

/** Legacy rate limit configuration using seconds instead of milliseconds */
export interface LegacyRateLimitConfig {
  /** Time window in seconds for rate limiting */
  windowSeconds?: number
  /** Maximum number of requests allowed within the window */
  max?: number
}

/** Extended rate limit configuration with batch API settings */
export interface ExtendedRateLimitConfig extends LegacyRateLimitConfig {
  /** Time window in seconds for batch API rate limiting */
  batchWindowSeconds?: number
  /** Maximum number of batch requests allowed within the window */
  batchMax?: number
}

/** Redis-specific configuration for rate limiting */
export interface RedisRateLimitConfig {
  /** Redis client instance */
  client: any
  /** Prefix for Redis keys used by the rate limiter */
  prefix: string
}

/** Options for initializing a RateLimiter instance */
export interface RateLimiterOptions {
  /** Rate limit configuration */
  limit: RateLimitConfig
  /** Redis configuration (optional) */
  redis?: RedisRateLimitConfig
  /** Logger instance for rate limiter operations */
  logger?: Logger
}

/** Options for creating rate limiters through factory functions */
export interface RateLimiterFactoryOptions {
  /** Application configuration containing rate limit settings */
  config?: {
    /** Rate limit configuration */
    limits?: ExtendedRateLimitConfig
  }
  /** Caching service instance */
  cachingService?: ICache
  /** Logger instance for rate limiter operations */
  logger?: Logger
}

/** Express middleware function type for rate limiting */
export type RateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => void

/** Base rate limiter class that provides rate limiting functionality using express-rate-limit */
declare class RateLimiter {
  /** Configuration options for the rate limiter */
  protected options: any

  /** Logger instance for rate limiter operations */
  protected logger: Logger

  /** Internal rate limiter instance from express-rate-limit */
  private _limiter: RateLimitMiddleware | null

  /**
   * Creates a new RateLimiter instance
   *
   * @param opts - Configuration options for the rate limiter
   */
  constructor(opts: any)

  /**
   * Initializes the rate limiter with optional store
   *
   * @param store - Optional store for rate limit data persistence
   * @returns This RateLimiter instance for method chaining
   */
  initialize(store?: Store): this

  /**
   * Gets the rate limiter middleware function
   *
   * @returns Express middleware function for rate limiting
   */
  get middleware(): RateLimitMiddleware

  /**
   * Builds rate limiter options for express-rate-limit
   *
   * @param config - Rate limit configuration
   * @param store - Optional store for rate limit data persistence
   * @returns Options object for express-rate-limit
   */
  static buildOptions(config: any, store?: Store): any
}

/** Redis-based rate limiter that extends RateLimiter with Redis persistence */
declare class RedisBasedRateLimiter extends RateLimiter {
  /** Redis client instance */
  private _client: any

  /**
   * Creates a new RedisBasedRateLimiter instance
   *
   * @param opts - Configuration options including Redis client
   */
  constructor(opts: any)

  /**
   * Initializes the Redis-based rate limiter
   *
   * @returns This RedisBasedRateLimiter instance for method chaining
   * @throws Error if Redis client is missing
   */
  initialize(): this

  /**
   * Builds a Redis store for rate limiting
   *
   * @param client - Redis client instance
   * @param config - Redis configuration with prefix
   * @returns Redis store instance for express-rate-limit
   */
  static buildRedisStore(client: any, config: any): Store
}

/** Abstract base class for middleware delegates that create rate limiting middleware asynchronously */
declare abstract class AbstractMiddlewareDelegate {
  /** Configuration options for the middleware delegate */
  protected options: any

  /** Logger instance for middleware operations */
  protected logger: Logger

  /** Cached inner middleware instance */
  private _innerMiddleware: RateLimitMiddleware | null

  /**
   * Creates a new AbstractMiddlewareDelegate instance
   *
   * @param opts - Configuration options for the middleware delegate
   */
  constructor(opts: any)

  /**
   * Gets the rate limiting middleware function
   *
   * @returns Express middleware function that handles async initialization
   */
  get middleware(): RateLimitMiddleware

  /**
   * Creates the inner middleware instance (private method)
   *
   * @returns Promise that resolves to the rate limiting middleware
   */
  private _createMiddleware(): Promise<RateLimitMiddleware>

  /**
   * Abstract method to create the inner middleware - must be implemented by subclasses
   *
   * @returns Promise that resolves to the rate limiting middleware
   */
  protected abstract createInnerMiddleware(): Promise<RateLimitMiddleware>
}

/** Middleware delegate for API rate limiting */
declare class ApiMiddlewareDelegate extends AbstractMiddlewareDelegate {
  /**
   * Creates the API rate limiting middleware
   *
   * @returns Promise that resolves to the API rate limiting middleware
   */
  protected createInnerMiddleware(): Promise<RateLimitMiddleware>
}

/** Middleware delegate for batch API rate limiting */
declare class BatchApiMiddlewareDelegate extends AbstractMiddlewareDelegate {
  /**
   * Creates the batch API rate limiting middleware
   *
   * @returns Promise that resolves to the batch API rate limiting middleware
   */
  protected createInnerMiddleware(): Promise<RateLimitMiddleware>
}

/**
 * Creates a rate limiter instance (Redis-based or memory-based)
 *
 * @param opts - Configuration options for the rate limiter
 * @returns RateLimiter or RedisBasedRateLimiter instance
 */
declare function createRateLimiter(opts: any): RateLimiter | RedisBasedRateLimiter

/**
 * Builds rate limiter options from configuration
 *
 * @param config - Rate limit configuration
 * @param cachingService - Caching service instance
 * @param prefix - Redis key prefix
 * @param logger - Logger instance
 * @returns Rate limiter options
 */
declare function buildOpts(config: LegacyRateLimitConfig, cachingService: ICache, prefix: string, logger?: Logger): any

/**
 * Creates an API rate limiter instance
 *
 * @param options - Factory options for creating the rate limiter
 * @returns RateLimiter instance for API rate limiting
 */
declare function createApiLimiter(options?: RateLimiterFactoryOptions): RateLimiter | RedisBasedRateLimiter

/**
 * Creates a batch API rate limiter instance
 *
 * @param options - Factory options for creating the rate limiter
 * @returns RateLimiter instance for batch API rate limiting
 */
declare function createBatchApiLimiter(options?: RateLimiterFactoryOptions): RateLimiter | RedisBasedRateLimiter

/**
 * Sets up API rate limiting middleware that initializes after caching service is ready
 *
 * @param config - Application configuration
 * @param cachingService - Caching service instance
 * @param logger - Logger instance
 * @returns Express middleware function for API rate limiting
 */
declare function setupApiRateLimiterAfterCachingInit(
  config: any,
  cachingService: any,
  logger?: Logger
): RateLimitMiddleware

/**
 * Sets up batch API rate limiting middleware that initializes after caching service is ready
 *
 * @param config - Application configuration
 * @param cachingService - Caching service instance
 * @param logger - Logger instance
 * @returns Express middleware function for batch API rate limiting
 */
declare function setupBatchApiRateLimiterAfterCachingInit(
  config: any,
  cachingService: any,
  logger?: Logger
): RateLimitMiddleware

export {
  RateLimiter,
  RedisBasedRateLimiter,
  AbstractMiddlewareDelegate,
  ApiMiddlewareDelegate,
  BatchApiMiddlewareDelegate,
  createRateLimiter,
  buildOpts,
  createApiLimiter,
  createBatchApiLimiter,
  setupApiRateLimiterAfterCachingInit,
  setupBatchApiRateLimiterAfterCachingInit,
  RateLimitConfig,
  LegacyRateLimitConfig,
  ExtendedRateLimitConfig,
  RedisRateLimitConfig,
  RateLimiterOptions,
  RateLimiterFactoryOptions,
  RateLimitMiddleware
}
