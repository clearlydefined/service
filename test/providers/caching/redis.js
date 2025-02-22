// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const assert = require('assert')
const redisCache = require('../../../providers/caching/redis')
const { RedisCache } = require('../../../providers/caching/redis')

const logger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

describe('Redis Cache', () => {
  describe('get a tool result', () => {
    const store = {}
    beforeEach(function () {
      sandbox.stub(RedisCache, 'initializeClient').resolves({
        get: async key => Promise.resolve(store[key]),
        set: async (key, value) => {
          store[key] = value
        },
        del: async key => {
          store[key] = null
        }
      })
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('works well for a specific tool version', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      await cache.set('foo', 'bar')
      const result = await cache.get('foo')
      assert.equal(result, 'bar')
    })

    it('works well for an object', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      await cache.set('foo', { temp: 3 })
      const result = await cache.get('foo')
      assert.equal(result.temp, 3)
    })

    it('returns null for missing entry', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      const result = await cache.get('bar')
      assert.equal(result, null)
    })

    it('deletes a key', async () => {
      const cache = redisCache({ logger })
      await cache.initialize()
      await cache.set('foo', 'bar')
      await cache.delete('foo')
      const result = await cache.get('foo')
      assert.ok(result === null)
    })
  })

  describe('Integration Test', () => {
    const apiKey = process.env['CACHING_REDIS_API_KEY']
    const service = process.env['CACHING_REDIS_SERVICE']

    describe('Redis Client Test', () => {
      let client
      beforeEach(async () => {
        client = await RedisCache.initializeClient({ apiKey, service }, logger)
      })

      afterEach(async () => {
        await client.disconnect()
      })

      it('retrieves empty initially', async () => {
        const value = await client.get('boo')
        assert.ok(value === null)
      })

      it('sets, gets and removes a value', async () => {
        await client.set('foo', 'bar')
        let value = await client.get('foo')
        assert.ok(value === 'bar')
        //clear the value
        await client.del('foo')
        value = await client.get('foo')
        assert.ok(value === null)
      })

      it('sets value and exipres', async () => {
        let value = await client.get('tee')
        assert.ok(value === null)

        await client.set('tee', 'value', { EX: 1 })
        value = await client.get('tee')
        assert.ok(value === 'value')

        await new Promise(resolve => setTimeout(resolve, 1200))
        value = await client.get('tee')
        assert.ok(value === null)
      }).timeout(3000)
    })

    describe('Redis Cache Test', () => {
      let cache
      beforeEach(async () => {
        cache = redisCache({ apiKey, service, logger })
        await cache.initialize()
      })

      afterEach(async () => {
        await cache.done()
      })

      it('should be empty initially', async () => {
        const value = await cache.get('boo')
        assert.ok(value === null)
      })

      it('sets, gets and removes a value', async () => {
        await cache.set('foo', 'bar')
        let value = await cache.get('foo')
        assert.ok(value === 'bar')
        //clear the value
        await cache.delete('foo')
        value = await cache.get('foo')
        assert.ok(value === null)
      })

      it('sets value and exipres', async () => {
        let value = await cache.get('wee')
        assert.ok(value === null)

        await cache.set('wee', 'value', 1)
        value = await cache.get('wee')
        assert.ok(value === 'value')

        await new Promise(resolve => setTimeout(resolve, 1200))
        value = await cache.get('wee')
        assert.ok(value === null)
      }).timeout(3000)
    })
  })
})
