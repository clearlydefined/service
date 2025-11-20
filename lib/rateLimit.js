// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { RedisStore } = require('rate-limit-redis')
const { rateLimit } = require('express-rate-limit')
const { RedisCache } = require('../providers/caching/redis')
const logger = require('../providers/logging/logger')

/**
 * @typedef {import('express-rate-limit').Store} ExpressRateLimitStore
 *
 * @typedef {import('../providers/logging').Logger} Logger
 *
 * @typedef {import('../providers/caching').ICache} ICache
 *
 * @typedef {import('./rateLimit').RateLimitConfig} RateLimitConfig
 *
 * @typedef {import('./rateLimit').LegacyRateLimitConfig} LegacyRateLimitConfig
 *
 * @typedef {import('./rateLimit').ExtendedRateLimitConfig} ExtendedRateLimitConfig
 *
 * @typedef {import('./rateLimit').RedisRateLimitConfig} RedisRateLimitConfig
 *
 * @typedef {import('./rateLimit').RateLimiterOptions} RateLimiterOptions
 *
 * @typedef {import('./rateLimit').RateLimiterFactoryOptions} RateLimiterFactoryOptions
 *
 * @typedef {import('./rateLimit').RateLimitMiddleware} RateLimitMiddleware
 *
 * @typedef {import('express-rate-limit').Options} ExpressRateLimitOptions
 *
 * @typedef {import('redis').RedisClientType} RedisClientType
 */

/**
 * Application configuration containing rate limiting settings
 *
 * @typedef {Object} AppConfig
 * @property {ExtendedRateLimitConfig} [limits] - Rate limiting configuration
 */

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
  /**
   * Creates a new RateLimiter instance.
   *
   * @param {RateLimiterOptions} opts - Configuration options for the rate limiter
   */
  constructor(opts) {
    this.options = opts
    this.logger = opts.logger || logger()
  }

  /**
   * Initializes the rate limiter with optional store. This method is idempotent - multiple calls will not create
   * multiple rate limiters.
   *
   * @param {ExpressRateLimitStore} [store] - Optional store for rate limit data persistence
   * @returns {RateLimiter} This RateLimiter instance for method chaining
   */
  initialize(store) {
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
   *
   * @returns {RateLimitMiddleware} Express middleware function for rate limiting
   */
  get middleware() {
    return this.initialize()._limiter
  }

  /**
   * Builds rate limiter options for express-rate-limit from configuration.
   *
   * @remarks
   *   When max is 0, the rate limiter is effectively disabled by setting skip: () => true. This follows the breaking
   *   changes in express-rate-limit v7.0.0.
   * @param {RateLimitConfig} config - Rate limit configuration
   * @param {ExpressRateLimitStore} [store] - Optional store for rate limit data persistence
   * @returns {Partial<ExpressRateLimitOptions>} Options for express-rate-limit
   * @see {@link https://github.com/express-rate-limit/express-rate-limit/releases/tag/v7.0.0}
   */
  static buildOptions({ windowMs, max }, store) {
    /** @type {Partial<ExpressRateLimitOptions>} */
    const opts = {
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false // Disable the `X-RateLimit-*` headers
    }
    if (max === 0) {
      opts.skip = () => true //See breaking changes in express-rate-limit v7.0.0 https://github.com/express-rate-limit/express-rate-limit/releases/tag/v7.0.0
    } else {
      opts.limit = max //limit is preferred over max
      opts.windowMs = windowMs
    }
    if (store) opts.store = store
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
  /**
   * Creates a new RedisBasedRateLimiter instance.
   *
   * @param {RateLimiterOptions} opts - Configuration options including Redis client
   */
  constructor(opts) {
    super(opts)
    this._client = opts.redis?.client
  }

  /**
   * Initializes the Redis-based rate limiter by creating a Redis store.
   *
   * @returns {RedisBasedRateLimiter} This RedisBasedRateLimiter instance for method chaining
   * @throws {Error} If Redis client is missing
   * @override
   */
  initialize() {
    if (!this._client) throw new Error('Redis client is missing')
    const store = RedisBasedRateLimiter.buildRedisStore(this._client, this.options.redis)
    super.initialize(store)
    return this
  }

  /**
   * Builds a Redis store for rate limiting using the rate-limit-redis package.
   *
   * @param {RedisClientType} client - Redis client instance
   * @param {RedisRateLimitConfig} config - Redis configuration
   * @returns {ExpressRateLimitStore} Redis store instance for express-rate-limit
   */
  static buildRedisStore(client, { prefix }) {
    return new RedisStore({
      prefix,
      sendCommand: (...args) => client.sendCommand(args)
    })
  }
}

/**
 * Creates a rate limiter instance based on the provided options. Returns a Redis-based rate limiter if Redis
 * configuration is provided, otherwise returns a memory-based rate limiter.
 *
 * @param {RateLimiterOptions} opts - Configuration options for the rate limiter
 * @returns {RateLimiter | RedisBasedRateLimiter} Rate limiter instance
 */
function createRateLimiter(opts) {
  return opts.redis ? new RedisBasedRateLimiter(opts) : new RateLimiter(opts)
}

/**
 * Builds rate limiter options from legacy configuration format. Converts seconds-based configuration to
 * milliseconds-based configuration.
 *
 * @param {LegacyRateLimitConfig} config - Rate limit configuration
 * @param {ICache} cachingService - Caching service instance
 * @param {string} prefix - Redis key prefix
 * @param {Logger} [logger] - Logger instance
 * @returns {RateLimiterOptions} Rate limiter options
 */
function buildOpts(config = { windowSeconds: 0, max: 0 }, cachingService, prefix, logger) {
  const { windowSeconds = 0, max = 0 } = config
  const limit = { windowMs: windowSeconds * 1000, max }
  const redis = cachingService instanceof RedisCache ? { client: cachingService.client, prefix } : undefined
  return { limit, redis, logger }
}

/**
 * Creates an API rate limiter instance using the provided configuration. Uses the main API rate limiting settings from
 * the configuration.
 *
 * @param {RateLimiterFactoryOptions} [options] - Factory options for creating the rate limiter
 * @returns {RateLimiter | RedisBasedRateLimiter} Rate limiter instance for API rate limiting
 */
function createApiLimiter({ config, cachingService, logger } = {}) {
  return createRateLimiter(buildOpts(config?.limits, cachingService, 'api', logger))
}

/**
 * Creates a batch API rate limiter instance using the provided configuration. Uses the batch API rate limiting settings
 * from the configuration.
 *
 * @param {RateLimiterFactoryOptions} [options] - Factory options for creating the rate limiter
 * @returns {RateLimiter | RedisBasedRateLimiter} Rate limiter instance for batch API rate limiting
 */
function createBatchApiLimiter({ config, cachingService, logger } = {}) {
  const { batchWindowSeconds, batchMax } = config?.limits || {}
  const opts = buildOpts({ windowSeconds: batchWindowSeconds, max: batchMax }, cachingService, 'batch-api', logger)
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
  /**
   * Creates a new AbstractMiddlewareDelegate instance.
   *
   * @param {RateLimiterFactoryOptions} opts - Configuration options for the middleware delegate
   */
  constructor(opts) {
    this.options = opts
    this.logger = opts.logger || logger()
  }

  /**
   * Gets the rate limiting middleware function that handles async initialization. The middleware function will create
   * the inner middleware on first call and cache it for subsequent requests.
   *
   * @returns {RateLimitMiddleware} Express middleware function that handles async initialization
   */
  get middleware() {
    return (request, response, next) => {
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
   * Creates the inner middleware instance with error handling and caching. This method ensures the middleware is only
   * created once and handles any errors that occur during creation.
   *
   * @private
   * @returns {Promise<RateLimitMiddleware>} Promise that resolves to the rate limiting middleware
   */
  async _createMiddleware() {
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
   *
   * @abstract
   * @returns {Promise<RateLimitMiddleware>} Promise that resolves to the rate limiting middleware
   * @throws {Error} If not implemented by subclass
   */
  async createInnerMiddleware() {
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
   *
   * @returns {Promise<RateLimitMiddleware>} Promise that resolves to the API rate limiting middleware
   * @override
   */
  async createInnerMiddleware() {
    this.logger.debug('Creating api rate-limiting middleware')
    await this.options.cachingService.initialize()
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
   *
   * @returns {Promise<RateLimitMiddleware>} Promise that resolves to the batch API rate limiting middleware
   * @override
   */
  async createInnerMiddleware() {
    this.logger.debug('Creating batch api rate-limiting middleware')
    await this.options.cachingService.initialize()
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
const setupApiRateLimiterAfterCachingInit = (config, cachingService, logger) => {
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
const setupBatchApiRateLimiterAfterCachingInit = (config, cachingService, logger) => {
  return new BatchApiMiddlewareDelegate({ config, cachingService, logger }).middleware
}

module.exports = {
  createApiLimiter,
  createBatchApiLimiter,
  RedisBasedRateLimiter,
  RateLimiter,
  setupApiRateLimiterAfterCachingInit,
  setupBatchApiRateLimiterAfterCachingInit
}
