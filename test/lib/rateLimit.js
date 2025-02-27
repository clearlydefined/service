// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const {
  RateLimiter,
  RedisBasedRateLimiter,
  createApiLimiter,
  createBatchApiLimiter
} = require('../../lib/rateLimit.js')
const supertest = require('supertest')
const express = require('express')
const sinon = require('sinon')
const { RedisCache } = require('../../providers/caching/redis')
const { GenericContainer } = require('testcontainers')

const logger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

const limit = { windowMs: 1000, max: 1 }

describe('Rate Limiter', () => {
  describe('Rate Limit Integration Tests', () => {
    let client

    beforeEach(async () => {
      const rateLimiter = new RateLimiter({ limit, logger })
      const app = await buildApp(rateLimiter)
      client = supertest(app)
    })

    it('allows requests under the limit', async () => {
      await client
        .get('/')
        .expect(200)
        .expect('Hello World!')
        .expect('RateLimit-Limit', '1')
        .expect('RateLimit-Remaining', '0')
    })

    it('blocks requests over the limit', async () => {
      const counter = await tryBeyondLimit(limit.max, client)
      assert.strictEqual(counter, limit.max, `Counter is ${counter}`)
    })
  })

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

    describe('Rate Limit Integration Tests', () => {
      let container, redisClient, client

      before(async () => {
        container = await new GenericContainer('redis').withExposedPorts(6379).start()
        const service = container.getHost()
        const port = container.getMappedPort(6379)
        const redisOpts = { service, port, tls: false }
        redisClient = await RedisCache.initializeClient(redisOpts, logger)
        const rateLimiter = new RedisBasedRateLimiter({ limit, redis: { client: redisClient }, logger })
        const app = await buildApp(rateLimiter)
        client = supertest(app)
      })

      after(async () => {
        await redisClient.quit()
        await container.stop()
      })

      afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, limit.windowMs))
      })

      it('allows requests under the limit', async () => {
        await client
          .get('/')
          .expect(200)
          .expect('Hello World!')
          .expect('RateLimit-Limit', '1')
          .expect('RateLimit-Remaining', '0')
      })

      it('blocks requests over the limit', async () => {
        const counter = await tryBeyondLimit(limit.max, client)
        assert.strictEqual(counter, limit.max, `Counter is ${counter}`)
      })
    })
  })

  describe('Create Rate Limiter', () => {
    const limits = {
      windowSeconds: 1,
      max: 0,
      batchWindowSeconds: 10,
      batchMax: 10
    }

    describe('Create Rate Limiter without Caching', () => {
      it('builds a rate limiter', () => {
        const rateLimiter = createApiLimiter({ limits }, undefined, logger)
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
        const batchRateLimiter = createBatchApiLimiter({ limits }, undefined, logger)
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
    })

    describe('Create Rate Limiter with Caching', () => {
      let caching
      beforeEach(() => {
        caching = new RedisCache({ logger })
        sinon.stub(caching, 'client').value({})
      })

      afterEach(() => {
        sinon.restore()
      })

      it('builds a redis based rate limiter', () => {
        const rateLimiter = createApiLimiter({ limits }, caching, logger)
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
        const batchRateLimiter = createBatchApiLimiter({ limits }, caching, logger)
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
})

async function tryBeyondLimit(max, client) {
  let counter = 0
  while (counter < max + 10) {
    const response = await client.get('/')
    if (!response.ok) break
    counter++
  }
  return counter
}

async function buildApp(rateLimiter) {
  const app = express()
  app.use(rateLimiter.middleware)
  app.get('/', (req, res) => res.send('Hello World!'))
  return app
}
