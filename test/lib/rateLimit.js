// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const {
  RateLimiter,
  RedisBasedRateLimiter,
  createApiLimiter,
  createBatchApiLimiter,
  setupApiRateLimiterAfterCachingInit,
  setupBatchApiRateLimiterAfterCachingInit
} = require('../../lib/rateLimit')
const supertest = require('supertest')
const express = require('express')
const sinon = require('sinon')
const { RedisCache } = require('../../providers/caching/redis')
const MemoryCache = require('../../providers/caching/memory')
const { GenericContainer } = require('testcontainers')

const logger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

const limit = { windowMs: 1000, max: 1 }

describe('Rate Limiter', () => {
  describe('Build Limit Options', () => {
    it('builds rate limit options', () => {
      const options = RateLimiter.buildOptions(limit)
      assert.deepStrictEqual(options, {
        standardHeaders: true,
        legacyHeaders: false,
        limit: 1,
        windowMs: 1000
      })
    })

    it('builds rate limit options with store', async () => {
      const store = {}
      const options = RateLimiter.buildOptions(limit, store)
      assert.deepStrictEqual(options, {
        standardHeaders: true,
        legacyHeaders: false,
        limit: 1,
        windowMs: 1000,
        store: {}
      })
    })

    it('builds rate limit options when max === 0', async () => {
      const options = RateLimiter.buildOptions({ windowSeconds: 1, max: 0 })
      assert.equal(options.standardHeaders, true)
      assert.equal(options.legacyHeaders, false)
      assert.equal(options.skip(), true)
    })
  })

  describe('Redis Based Rate Limiter', () => {
    it('throws error if redis client is missing', async () => {
      try {
        //eslint-disable-next-line no-unused-vars
        const middleware = new RedisBasedRateLimiter({ limit, logger }).middleware
        assert.fail('Should have thrown error')
      } catch (error) {
        assert.strictEqual(error.message, 'Redis client is missing')
      }
    })
  })

  describe('Create Rate Limiter', () => {
    const limits = {
      windowSeconds: 1,
      max: 0,
      batchWindowSeconds: 10,
      batchMax: 10
    }

    describe('Memory Based', () => {
      const options = { config: { limits }, cachingService: undefined, logger }
      it('builds a rate limiter', () => {
        const rateLimiter = createApiLimiter(options)
        assert.ok(rateLimiter instanceof RateLimiter)
        const expected = {
          limit: {
            windowMs: 1000,
            max: 0
          },
          redis: undefined,
          logger
        }
        assert.deepStrictEqual(rateLimiter.options, expected)
      })

      it('builds a batch rate limiter', () => {
        const batchRateLimiter = createBatchApiLimiter(options)
        assert.ok(batchRateLimiter instanceof RateLimiter)
        const expected = {
          limit: {
            windowMs: 10000,
            max: 10
          },
          redis: undefined,
          logger
        }
        assert.deepStrictEqual(batchRateLimiter.options, expected)
      })

      it('builds a api rate limiter with default', () => {
        const batchRateLimiter = createApiLimiter()
        assert.ok(batchRateLimiter instanceof RateLimiter)
      })

      it('builds a batch rate limiter with default', () => {
        const batchRateLimiter = createBatchApiLimiter()
        assert.ok(batchRateLimiter instanceof RateLimiter)
      })
    })

    describe('Redis Based', () => {
      let options
      beforeEach(() => {
        const cachingService = new RedisCache({ logger })
        sinon.stub(cachingService, 'client').value({})
        options = { config: { limits }, cachingService, logger }
      })

      afterEach(() => {
        sinon.restore()
      })

      it('builds a redis based rate limiter', () => {
        const rateLimiter = createApiLimiter(options)
        assert.ok(rateLimiter instanceof RedisBasedRateLimiter)
        const expected = {
          limit: {
            windowMs: 1000,
            max: 0
          },
          redis: {
            client: {},
            prefix: 'api'
          },
          logger
        }
        assert.deepStrictEqual(rateLimiter.options, expected)
      })

      it('builds a redis based batch rate limiter', () => {
        const batchRateLimiter = createBatchApiLimiter(options)
        assert.ok(batchRateLimiter instanceof RedisBasedRateLimiter)
        const expected = {
          limit: {
            windowMs: 10000,
            max: 10
          },
          redis: {
            client: {},
            prefix: 'batch-api'
          },
          logger
        }
        assert.deepStrictEqual(batchRateLimiter.options, expected)
      })
    })
  })

  describe('Create MiddlewareDelegate', () => {
    let cachingService

    beforeEach(() => {
      cachingService = { initialize: sinon.stub().resolves() }
    })

    it('creates api rate limit middleware function', () => {
      const middleware = setupApiRateLimiterAfterCachingInit({}, cachingService, logger)
      assert.equal(typeof middleware, 'function')
      assert.ok(cachingService.initialize.notCalled)
    })

    it('creates batch api rate limit middleware function', () => {
      const middleware = setupBatchApiRateLimiterAfterCachingInit({}, cachingService, logger)
      assert.equal(typeof middleware, 'function')
      assert.ok(cachingService.initialize.notCalled)
    })
  })

  describe('Rate Limit Integration Test', () => {
    let client

    afterEach(async () => {
      await new Promise(resolve => setTimeout(resolve, limit.windowMs))
    })

    const verifyRateLimiting = function () {
      it('allows requests under the limit', async () => {
        await client
          ?.get('/')
          .expect(200)
          .expect('Hello World!')
          .expect('RateLimit-Limit', '1')
          .expect('RateLimit-Remaining', '0')
      })

      it('blocks requests over the limit', async () => {
        const counter = await tryBeyondLimit(limit.max, client)
        assert.strictEqual(counter, limit.max, `Counter is ${counter}`)
      })
    }

    describe('Memory Based Rate Limiter', () => {
      before(async () => {
        const rateLimiter = new RateLimiter({ limit, logger })
        client = await buildTestAppClient(rateLimiter.middleware)
      })

      verifyRateLimiting()
    })

    describe('Redis Based Rate Limiter', () => {
      let container, redisClient, redisOpts

      before(async function () {
        this.timeout(15000)
        ;({ redisOpts, container } = await startRedis())
        redisClient = await RedisCache.initializeClient(redisOpts, logger)
        const rateLimiter = new RedisBasedRateLimiter({ limit, redis: { client: redisClient }, logger })
        client = await buildTestAppClient(rateLimiter.middleware)
      })

      after(async function () {
        await redisClient.quit()
        await container.stop()
      })

      verifyRateLimiting()
    })

    describe('MiddlewareDelegate - Redis Based', () => {
      const config = { limits: { windowSeconds: 1, max: 1 } }
      let container, cachingService, redisOpts

      before(async function () {
        this.timeout(15000)
        ;({ container, redisOpts } = await startRedis())
        cachingService = new RedisCache({ ...redisOpts, logger })
        const middleware = setupApiRateLimiterAfterCachingInit(config, cachingService, logger)
        client = await buildTestAppClient(middleware)
      })

      after(async () => {
        await cachingService.done()
        await container.stop()
      })

      verifyRateLimiting()
    })

    describe('MiddlewareDelegate - Memory Based', () => {
      const config = { limits: { windowSeconds: 1, max: 1 } }

      before(async function () {
        const middleware = setupApiRateLimiterAfterCachingInit(config, MemoryCache(), logger)
        client = await buildTestAppClient(middleware)
      })

      verifyRateLimiting()
    })
  })
})

async function startRedis() {
  const container = await new GenericContainer('redis').withExposedPorts(6379).start()
  const service = container.getHost()
  const port = container.getMappedPort(6379)
  const redisOpts = { service, port, tls: false }
  return { redisOpts, container }
}

async function tryBeyondLimit(max, client) {
  let counter = 0
  while (counter < max + 10) {
    const response = await client.get('/')
    if (!response.ok) break
    counter++
  }
  return counter
}

async function buildTestAppClient(rateLimiter) {
  const app = express()
  app.use(rateLimiter)
  app.get('/', (req, res) => res.send('Hello World!'))
  return supertest(app)
}
