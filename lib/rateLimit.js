// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { RedisStore } = require('rate-limit-redis')
const { rateLimit } = require('express-rate-limit')
const { RedisCache } = require('../providers/caching/redis')
const logger = require('../providers/logging/logger')

class RateLimiter {
  constructor(opts) {
    this.options = opts
    this.logger = opts.logger || logger()
  }

  // Initialize the rate limiter with optional store
  initialize(store) {
    if (!this._limiter) {
      this.logger.debug('Creating rate limiter', this.options.limit)
      const options = RateLimiter.buildOptions(this.options.limit, store)
      this._limiter = rateLimit(options)
      this.logger.debug('Rate limiter initialized')
    }
    return this
  }

  // Return the rate limiter middleware
  get middleware() {
    return this.initialize()._limiter
  }

  // Build rate limiter options
  static buildOptions({ windowMs, max }, store) {
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

class RedisBasedRateLimiter extends RateLimiter {
  constructor(opts) {
    super(opts)
    this._client = opts.redis?.client
  }

  initialize() {
    if (!this._client) throw new Error('Redis client is missing')
    const store = RedisBasedRateLimiter.buildRedisStore(this._client, this.options.redis)
    return super.initialize(store)
  }

  static buildRedisStore(client, { prefix }) {
    return new RedisStore({
      prefix,
      sendCommand: (...args) => client.sendCommand(args)
    })
  }
}

function createRateLimiter(opts) {
  return opts.redis ? new RedisBasedRateLimiter(opts) : new RateLimiter(opts)
}

function buildOpts({ windowSeconds = 0, max = 0 } = {}, cachingService, prefix, logger) {
  const limit = { windowMs: windowSeconds * 1000, max }
  const redis = cachingService instanceof RedisCache ? { client: cachingService.client, prefix } : undefined
  return { limit, redis, logger }
}

function createApiLimiter({ config, cachingService, logger } = {}) {
  return createRateLimiter(buildOpts(config?.limits, cachingService, 'api', logger))
}

function createBatchApiLimiter({ config, cachingService, logger } = {}) {
  const { batchWindowSeconds, batchMax } = config?.limits || {}
  const opts = buildOpts({ windowSeconds: batchWindowSeconds, max: batchMax }, cachingService, 'batch-api', logger)
  return createRateLimiter(opts)
}

class AbstractMiddlewareDelegate {
  constructor(opts) {
    this.options = opts
    this.logger = opts.logger || logger()
  }

  get middleware() {
    return (request, response, next) => {
      this._createMiddleware()
        .catch(error => next(error))
        .then(middleware => middleware(request, response, next))
    }
  }

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

  async createInnerMiddleware() {
    throw new Error('Not implemented')
  }
}

class ApiMiddlewareDelegate extends AbstractMiddlewareDelegate {
  async createInnerMiddleware() {
    this.logger.debug('Creating api rate-limiting middleware')
    await this.options.cachingService.initialize()
    return createApiLimiter(this.options).middleware
  }
}

class BatchApiMiddlewareDelegate extends AbstractMiddlewareDelegate {
  async createInnerMiddleware() {
    this.logger.debug('Creating batch api rate-limiting middleware')
    await this.options.cachingService.initialize()
    return createBatchApiLimiter(this.options).middleware
  }
}

const setupApiRateLimiterAfterCachingInit = (config, cachingService, logger) =>
  new ApiMiddlewareDelegate({ config, cachingService, logger }).middleware

const setupBatchApiRateLimiterAfterCachingInit = (config, cachingService, logger) =>
  new BatchApiMiddlewareDelegate({ config, cachingService, logger }).middleware

module.exports = {
  createApiLimiter,
  createBatchApiLimiter,
  RedisBasedRateLimiter,
  RateLimiter,
  setupApiRateLimiterAfterCachingInit,
  setupBatchApiRateLimiterAfterCachingInit
}
