// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const assert = require('assert')
const redisCache = require('../../../providers/caching/redis')
const { RedisCache } = require('../../../providers/caching/redis')
const { GenericContainer } = require('testcontainers')

const logger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

describe('Redis Cache', () => {
  describe('get a tool result', () => {
    const store = {}
    let mockClient
    beforeEach(function () {
      mockClient = {
        get: async key => Promise.resolve(store[key]),
        set: async (key, value) => {
          store[key] = value
        },
        del: async key => {
          store[key] = null
        },
        connect: async () => Promise.resolve(mockClient),
        on: () => {},
        quit: sinon.stub().resolves()
      }
      sandbox.stub(RedisCache, 'buildRedisClient').returns(mockClient)
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('works well for a specific tool version', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      await cache.set('foo', 'bar')
      const result = await cache.get('foo')
      assert.strictEqual(result, 'bar')
    })

    it('works well for an object', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      await cache.set('foo', { temp: 3 })
      const result = await cache.get('foo')
      assert.strictEqual(result.temp, 3)
    })

    it('returns null for missing entry', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      const result = await cache.get('bar')
      assert.strictEqual(result, null)
    })

    it('deletes a key', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      await cache.set('foo', 'bar')
      await cache.delete('foo')
      const result = await cache.get('foo')
      assert.strictEqual(result, null)
    })

    it('throws error if redis connection fails', async () => {
      mockClient.connect = () => Promise.reject(new Error('Connection failed'))
      const cache = redisCache({ logger })
      try {
        await cache.initialize()
      } catch (error) {
        assert.strictEqual(error.message, 'Connection failed')
      }
    })

    it('initalizes client only once', async () => {
      const cache = redisCache({ logger })
      await Promise.all([cache.initialize(), cache.initialize()])
      assert.ok(RedisCache.buildRedisClient.calledOnce)
    })

    it('calls client.quit only once', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      await Promise.all([cache.done(), cache.done()])
      assert.ok(mockClient.quit.calledOnce)
    })
  })

  describe('Integration Test', () => {
    let container, redisConfig

    before(async function () {
      this.timeout(10000)
      container = await new GenericContainer('redis').withExposedPorts(6379).start()
      const service = container.getHost()
      const port = container.getMappedPort(6379)
      redisConfig = { service, port, tls: false }
    })

    after(async () => {
      await container?.stop()
    })

    describe('Redis Client Test', () => {
      let client
      before(async () => {
        client = await RedisCache.initializeClient(redisConfig, logger)
      })

      after(async () => {
        await client.quit()
      })

      it('retrieves empty initially', async () => {
        const value = await client.get('boo')
        assert.strictEqual(value, null)
      })

      it('sets, gets and removes a value', async () => {
        await client.set('foo', 'bar')
        let value = await client.get('foo')
        assert.strictEqual(value, 'bar')
        //clear the value
        await client.del('foo')
        value = await client.get('foo')
        assert.strictEqual(value, null)
      })

      it('sets value and exipres', async () => {
        let value = await client.get('tee')
        assert.strictEqual(value, null)

        await client.set('tee', 'value', { EX: 1 })
        value = await client.get('tee')
        assert.strictEqual(value, 'value')

        await new Promise(resolve => setTimeout(resolve, 1010))
        value = await client.get('tee')
        assert.strictEqual(value, null)
      })
    })

    describe('Redis Cache Test', () => {
      let cache
      before(async () => {
        cache = redisCache({ ...redisConfig, logger })
        await cache.initialize()
      })

      after(async () => {
        await cache.done()
      })

      it('retrieves empty initially', async () => {
        const value = await cache.get('boo')
        assert.strictEqual(value, null)
      })

      it('sets, gets and removes a string', async () => {
        await cache.set('foo', 'bar')
        let value = await cache.get('foo')
        assert.strictEqual(value, 'bar')
        //clear the value
        await cache.delete('foo')
        value = await cache.get('foo')
        assert.strictEqual(value, null)
      })

      it('sets, gets and removes a object', async () => {
        const obj = { foo: 'bar' }
        await cache.set('foo', obj)
        let value = await cache.get('foo')
        assert.deepStrictEqual(value, obj)
        //clear the value
        await cache.delete('foo')
        value = await cache.get('foo')
        assert.strictEqual(value, null)
      })

      it('sets value and exipres', async () => {
        let value = await cache.get('wee')
        assert.strictEqual(value, null)

        await cache.set('wee', 'value', 1)
        value = await cache.get('wee')
        assert.strictEqual(value, 'value')

        await new Promise(resolve => setTimeout(resolve, 1010))
        value = await cache.get('wee')
        assert.strictEqual(value, null)
      })
    })
  })
})
