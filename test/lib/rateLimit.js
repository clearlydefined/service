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
const sandbox = require('sinon').createSandbox()
const { RedisCache } = require('../../providers/caching/redis')
const { GenericContainer } = require('testcontainers')

const logger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

const limit = { windowMs: 1000, max: 1 }

describe('Rate Limiter', () => {
  describe('Rate Limiter Tests', () => {
    let client, rateLimiter

    beforeEach(async () => {
      rateLimiter = new RateLimiter({ limit, logger })
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
    let client, rateLimiter
    let container, redis

    before(async () => {
      container = await new GenericContainer('redis').withExposedPorts(6379).start()
      const service = container.getHost()
      const port = container.getMappedPort(6379)
      redis = { service, port, tls: false }
    })

    after(async () => {
      await container.stop()
    })

    describe('Handling errors', () => {
      let rateLimiter

      afterEach(async () => {
        await rateLimiter.done()
        sandbox.restore()
      })

      it('throws error if redis configuration is missing', async () => {
        try {
          rateLimiter = new RedisBasedRateLimiter({ limit, logger })
          await rateLimiter.initialize()
        } catch (error) {
          assert.ok(error.message === 'Redis configuration is missing')
        }
      })

      it('throws error if connecting to redis fails', async () => {
        sandbox.stub(RedisCache, 'buildRedisClient').returns({
          connect: () => Promise.reject(new Error('Connection failed'))
        })
        try {
          rateLimiter = new RedisBasedRateLimiter({ limit, redis, logger })
          await rateLimiter.initialize()
        } catch (error) {
          assert.equal(error.message, 'Connection failed')
        }
      })
    })

    describe('Rate Limit Integration Tests', () => {
      before(async () => {
        rateLimiter = new RedisBasedRateLimiter({ limit, redis, logger })
        const app = await buildApp(rateLimiter)
        client = supertest(app)
      })

      after(async () => {
        await rateLimiter.done()
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
    const caching = {
      caching_redis_service: 'host',
      caching_redis_api_key: 'key'
    }

    it('builds a rate limiter', () => {
      const rateLimiter = createApiLimiter({ limits })
      assert.ok(rateLimiter instanceof RateLimiter)
      const expected = {
        limit: {
          windowMs: 1000,
          max: 0
        },
        redis: undefined,
        logger: undefined
      }
      assert.deepStrictEqual(rateLimiter.options, expected)
    })

    it('builds a batch rate limiter', () => {
      const batchRateLimiter = createBatchApiLimiter({ limits })
      assert.ok(batchRateLimiter instanceof RateLimiter)
      const expected = {
        limit: {
          windowMs: 10000,
          max: 10
        },
        redis: undefined,
        logger: undefined
      }
      assert.deepStrictEqual(batchRateLimiter.options, expected)
    })

    it('builds a redis based rate limiter', () => {
      const rateLimiter = createApiLimiter({ limits, caching })
      assert.ok(rateLimiter instanceof RedisBasedRateLimiter)
      const expected = {
        limit: {
          windowMs: 1000,
          max: 0
        },
        redis: {
          service: 'host',
          apiKey: 'key',
          prefix: 'api'
        },
        logger: undefined
      }
      assert.deepStrictEqual(rateLimiter.options, expected)
    })

    it('builds a redis based batch rate limiter', () => {
      const batchRateLimiter = createBatchApiLimiter({ limits, caching })
      assert.ok(batchRateLimiter instanceof RedisBasedRateLimiter)
      const expected = {
        limit: {
          windowMs: 10000,
          max: 10
        },
        redis: {
          service: 'host',
          apiKey: 'key',
          prefix: 'batch-api'
        },
        logger: undefined
      }
      assert.deepStrictEqual(batchRateLimiter.options, expected)
    })
  })
})

async function tryBeyondLimit(max, client) {
  let counter = 0
  while (counter < max + 10) {
    const response = await client.get('/')
    if (!response.ok) {
      break
    }
    counter++
  }
  return counter
}

async function buildApp(rateLimiter) {
  const app = express()
  await rateLimiter.initialize()
  app.use(rateLimiter.middleware)
  app.get('/', (req, res) => res.send('Hello World!'))
  return app
}
