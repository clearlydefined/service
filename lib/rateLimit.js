// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { createClient } = require('redis')
const { RedisStore } = require('rate-limit-redis')
const { rateLimit } = require('express-rate-limit')
const { RedisCache } = require('../providers/caching/redis')

class RateLimiter {
  constructor(opts) {
    this.options = opts
    this.logger = opts.logger
  }

  async initialize(store) {
    if (!this._limiter) {
      this.logger.debug('Creating rate limiter: %o', this.options.limit)
      this._limiter = RateLimiter.build(this.options.limit, store)
      this.logger.info('Rate limiter initialized')
    }
  }

  get middleware() {
    return this._limiter
  }

  async done() {
    //do nothing
    this.logger.info('Rate limiter done')
  }

  static build({ windowMs, max }, store) {
    //TODO: use standardHeaders?
    const opts = {
      windowMs,
      max,
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false // Disable the `X-RateLimit-*` headers
    }
    if (store) {
      opts.store = store
    }
    return rateLimit(opts)
  }
}

class RedisBackedRateLimiter extends RateLimiter {
  async initialize() {
    if (!this._limiter) {
      this._client = await this._initializeClient()
      const store = RedisBackedRateLimiter.buildRedisStore(this._client, this.options.redis)
      await super.initialize(store)
    }
  }

  async done() {
    return this._client?.disconnect().then(() => super.done())
  }

  async _initializeClient() {
    if (!this.options.redis) throw new Error('Redis configuration is missing')
    return RedisCache.initializeClient(this.options.redis, this.logger)
  }

  static buildRedisStore(client, { prefix }) {
    return new RedisStore({
      prefix,
      sendCommand: (...args) => client.sendCommand(args)
    })
  }
}

function createRateLimiter(config) {
  return config.redis ? new RedisBackedRateLimiter(config) : new RateLimiter(config)
}

function buildOpts({ windowSeconds, max }, logger, { caching_redis_service, caching_redis_api_key } = {}, prefix) {
  const limit = {
    windowMs: windowSeconds * 1000,
    max
  }
  let redis
  if (caching_redis_service) {
    redis = {
      service: caching_redis_service,
      apiKey: caching_redis_api_key,
      prefix
    }
  }
  return { limit, redis, logger }
}

function buildBatchOpts({ batchWindowSeconds, batchMax }, ...args) {
  return buildOpts({ windowSeconds: batchWindowSeconds, max: batchMax }, ...args)
}

function createApiLimiter(config, logger) {
  return createRateLimiter(buildOpts(config.limits, logger, config.caching, 'api'))
}

function createBatchApiLimiter(config, logger) {
  return createRateLimiter(buildBatchOpts(config.limits, logger, config.caching, 'batch-api'))
}

module.exports = {
  createApiLimiter,
  createBatchApiLimiter,
  RedisBackedRateLimiter,
  RateLimiter
}
