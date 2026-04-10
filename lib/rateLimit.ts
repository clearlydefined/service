// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { NextFunction, Request, Response } from 'express'
import type { Options as ExpressRateLimitOptions, Store as ExpressRateLimitStore } from 'express-rate-limit'
import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import type { RedisClientType } from 'redis'
import type { ICache } from '../providers/caching/index.js'
import { RedisCache } from '../providers/caching/redis.js'
import type { Logger } from '../providers/logging/index.js'
import logger from '../providers/logging/logger.js'

/** Configuration options for rate limiting window and maximum requests */
export interface RateLimitConfig {
  windowMs: number
  max: number
}

/** Legacy rate limit configuration using seconds instead of milliseconds */
export interface LegacyRateLimitConfig {
  windowSeconds?: number
  max?: number
}

/** Extended rate limit configuration with batch API settings */
export interface ExtendedRateLimitConfig extends LegacyRateLimitConfig {
  batchWindowSeconds?: number
  batchMax?: number
}

/** Redis-specific configuration for rate limiting */
export interface RedisRateLimitConfig {
  client: RedisClientType
  prefix: string
}

/** Options for initializing a RateLimiter instance */
export interface RateLimiterOptions {
  limit: RateLimitConfig
  redis?: RedisRateLimitConfig
  logger?: Logger
}

/** Options for creating rate limiters through factory functions */
export interface RateLimiterFactoryOptions {
  config?: {
    limits?: ExtendedRateLimitConfig
  }
  cachingService?: ICache
  logger?: Logger
}

/** Express middleware function type for rate limiting */
export type RateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => void

/** Application configuration containing rate limiting settings */
interface AppConfig {
  limits?: ExtendedRateLimitConfig
}

/**
 * Base rate limiter class that provides rate limiting functionality using express-rate-limit. This class can be used
 * with either in-memory storage or with a custom store for persistence.
 *
 * @example
 *   ;```javascript
 *   const rateLimiter = new RateLimiter({
 *     limit: { windowMs: 15 * 60 * 1000, max: 100 },
 *     logger: myLogger
 *   })
 *   app.use(rateLimiter.middleware)
 *   ```
 */
class RateLimiter {
  protected options: RateLimiterOptions
  protected logger: Logger
  private _limiter: RateLimitMiddleware | null

  /**
   * Creates a new RateLimiter instance.
   */
  constructor(opts: RateLimiterOptions) {
    this.options = opts
    this.logger = opts.logger || logger()
    this._limiter = null
  }

  /**
   * Initializes the rate limiter with optional store.
   */
  initialize(store?: ExpressRateLimitStore): this {
    if (!this._limiter) {
      this.logger.debug('Creating rate limiter', this.options.limit)
      const options = RateLimiter.buildOptions(this.options.limit, store)
      this._limiter = rateLimit(options)
      this.logger.debug('Rate limiter initialized')
    }
    return this
  }

  /**
   * Gets the rate limiter middleware function ready to be used with Express.
   */
  get middleware(): RateLimitMiddleware {
    return this.initialize()._limiter!
  }

  /**
   * Builds rate limiter options for express-rate-limit from configuration.
   */
  static buildOptions(
    { windowMs, max }: RateLimitConfig,
    store?: ExpressRateLimitStore
  ): Partial<ExpressRateLimitOptions> {
    const opts: Partial<ExpressRateLimitOptions> = {
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false // Disable the `X-RateLimit-*` headers
    }
    if (max === 0) {
      opts.skip = () => true //See breaking changes in express-rate-limit v7.0.0 https://github.com/express-rate-limit/express-rate-limit/releases/tag/v7.0.0
    } else {
      opts.limit = max //limit is preferred over max
      opts.windowMs = windowMs
    }
    if (store) {
      opts.store = store
    }
    return opts
  }
}

/**
 * Redis-based rate limiter that extends RateLimiter with Redis persistence. This class provides distributed rate
 * limiting across multiple application instances by storing rate limit data in Redis.
 *
 * @example
 *   ;```javascript
 *   const rateLimiter = new RedisBasedRateLimiter({
 *     limit: { windowMs: 15 * 60 * 1000, max: 100 },
 *     redis: { client: redisClient, prefix: 'api-rate-limit' },
 *     logger: myLogger
 *   })
 *   app.use(rateLimiter.middleware)
 *   ```
 *
 * @extends RateLimiter
 */
class RedisBasedRateLimiter extends RateLimiter {
  private _client: RedisClientType | undefined

  /**
   * Creates a new RedisBasedRateLimiter instance.
   */
  constructor(opts: RateLimiterOptions) {
    super(opts)
    this._client = opts.redis?.client
  }

  override initialize(): this {
    if (!this._client) {
      throw new Error('Redis client is missing')
    }
    const store = RedisBasedRateLimiter.buildRedisStore(this._client, this.options.redis!)
    super.initialize(store)
    return this
  }

  /**
   * Builds a Redis store for rate limiting using the rate-limit-redis package.
   */
  static buildRedisStore(client: RedisClientType, { prefix }: RedisRateLimitConfig): ExpressRateLimitStore {
    return new RedisStore({
      prefix,
      sendCommand: (...args) => client.sendCommand(args)
    })
  }
}

/**
 * Creates a rate limiter instance based on the provided options.
 */
function createRateLimiter(opts: RateLimiterOptions): RateLimiter | RedisBasedRateLimiter {
  return opts.redis ? new RedisBasedRateLimiter(opts) : new RateLimiter(opts)
}

/**
 * Builds rate limiter options from legacy configuration format.
 */
function buildOpts(
  config: LegacyRateLimitConfig = { windowSeconds: 0, max: 0 },
  cachingService: ICache,
  prefix: string,
  logger?: Logger
): RateLimiterOptions {
  const { windowSeconds = 0, max = 0 } = config
  const limit = { windowMs: windowSeconds * 1000, max }
  const redis = cachingService instanceof RedisCache ? { client: cachingService.client!, prefix } : undefined
  return { limit, redis, logger }
}

/**
 * Creates an API rate limiter instance using the provided configuration.
 */
function createApiLimiter({
  config,
  cachingService,
  logger
}: RateLimiterFactoryOptions = {}): RateLimiter | RedisBasedRateLimiter {
  return createRateLimiter(buildOpts(config?.limits, cachingService!, 'api', logger))
}

/**
 * Creates a batch API rate limiter instance using the provided configuration.
 */
function createBatchApiLimiter({
  config,
  cachingService,
  logger
}: RateLimiterFactoryOptions = {}): RateLimiter | RedisBasedRateLimiter {
  const { batchWindowSeconds, batchMax } = config?.limits || {}
  const opts = buildOpts({ windowSeconds: batchWindowSeconds, max: batchMax }, cachingService!, 'batch-api', logger)
  return createRateLimiter(opts)
}

/**
 * Abstract base class for middleware delegates that create rate limiting middleware asynchronously. This allows for
 * lazy initialization of rate limiters after dependencies (like caching services) have been properly initialized.
 *
 * @example
 *   ;```javascript
 *   class MyMiddlewareDelegate extends AbstractMiddlewareDelegate {
 *     async createInnerMiddleware() {
 *       await this.options.cachingService.initialize()
 *       return createApiLimiter(this.options).middleware
 *     }
 *   }
 *   ```
 *
 * @abstract
 */
class AbstractMiddlewareDelegate {
  protected options: RateLimiterFactoryOptions
  protected logger: Logger
  private _innerMiddleware: RateLimitMiddleware | null

  /**
   * Creates a new AbstractMiddlewareDelegate instance.
   */
  constructor(opts: RateLimiterFactoryOptions) {
    this.options = opts
    this.logger = opts.logger || logger()
    this._innerMiddleware = null
  }

  /**
   * Gets the rate limiting middleware function that handles async initialization.
   */
  get middleware(): RateLimitMiddleware {
    return (request: Request, response: Response, next: NextFunction) => {
      this._createMiddleware()
        .then(middleware => {
          if (middleware) {
            middleware(request, response, next)
          } else {
            next(new Error('Failed to create middleware'))
          }
        })
        .catch(error => next(error))
    }
  }

  /**
   * Creates the inner middleware instance with error handling and caching.
   */
  async _createMiddleware(): Promise<RateLimitMiddleware> {
    if (!this._innerMiddleware) {
      try {
        this._innerMiddleware = await this.createInnerMiddleware()
      } catch (error) {
        this.logger.error('Error creating inner middleware', error)
        throw error
      }
    }
    return this._innerMiddleware
  }

  /**
   * Abstract method to create the inner middleware - must be implemented by subclasses.
   */
  async createInnerMiddleware(): Promise<RateLimitMiddleware> {
    throw new Error('Not implemented')
  }
}

/**
 * Middleware delegate for API rate limiting that initializes after the caching service is ready. This ensures that
 * Redis-based rate limiting is properly configured before handling requests.
 *
 * @extends AbstractMiddlewareDelegate
 */
class ApiMiddlewareDelegate extends AbstractMiddlewareDelegate {
  /**
   * Creates the API rate limiting middleware by initializing the caching service first.
   */
  override async createInnerMiddleware(): Promise<RateLimitMiddleware> {
    this.logger.debug('Creating api rate-limiting middleware')
    await this.options.cachingService!.initialize()
    return createApiLimiter(this.options).middleware
  }
}

/**
 * Middleware delegate for batch API rate limiting that initializes after the caching service is ready. This ensures
 * that Redis-based rate limiting is properly configured before handling batch requests.
 *
 * @extends AbstractMiddlewareDelegate
 */
class BatchApiMiddlewareDelegate extends AbstractMiddlewareDelegate {
  /**
   * Creates the batch API rate limiting middleware by initializing the caching service first.
   */
  override async createInnerMiddleware(): Promise<RateLimitMiddleware> {
    this.logger.debug('Creating batch api rate-limiting middleware')
    await this.options.cachingService!.initialize()
    return createBatchApiLimiter(this.options).middleware
  }
}

/**
 * Sets up API rate limiting middleware that initializes after the caching service is ready. This function returns a
 * middleware function that will handle the async initialization of the rate limiter on first request.
 *
 * @example
 *   ;```javascript
 *   const middleware = setupApiRateLimiterAfterCachingInit(config, cachingService, logger)
 *   app.use('/api', middleware)
 *   ```
 *
 * @param {AppConfig} config - Application configuration
 * @param {ICache} cachingService - Caching service instance
 * @param {Logger} [logger] - Logger instance
 * @returns {RateLimitMiddleware} Express middleware function for API rate limiting
 */
const setupApiRateLimiterAfterCachingInit = (
  config: AppConfig,
  cachingService: ICache,
  logger?: Logger
): RateLimitMiddleware => {
  return new ApiMiddlewareDelegate({ config, cachingService, logger }).middleware
}

/**
 * Sets up batch API rate limiting middleware that initializes after the caching service is ready. This function returns
 * a middleware function that will handle the async initialization of the rate limiter on first request.
 *
 * @example
 *   ;```javascript
 *   const middleware = setupBatchApiRateLimiterAfterCachingInit(config, cachingService, logger)
 *   app.use('/api/batch', middleware)
 *   ```
 *
 * @param {AppConfig} config - Application configuration
 * @param {ICache} cachingService - Caching service instance
 * @param {Logger} [logger] - Logger instance
 * @returns {RateLimitMiddleware} Express middleware function for batch API rate limiting
 */
const setupBatchApiRateLimiterAfterCachingInit = (
  config: AppConfig,
  cachingService: ICache,
  logger?: Logger
): RateLimitMiddleware => {
  return new BatchApiMiddlewareDelegate({ config, cachingService, logger }).middleware
}

export {
  createApiLimiter,
  createBatchApiLimiter,
  RateLimiter,
  RedisBasedRateLimiter,
  setupApiRateLimiterAfterCachingInit,
  setupBatchApiRateLimiterAfterCachingInit
}
