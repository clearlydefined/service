// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const assert = require('assert')
const redisCache = require('../../../providers/caching/redis')
const { RedisCache } = require('../../../providers/caching/redis')
const { GenericContainer } = require('testcontainers')
const pako1 = require('pako-1')
const pako2 = require('pako')

const logger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

describe('Redis Cache', () => {
  describe('get a tool result', () => {
    const store = {}
    let mockClient, cache
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
      cache = redisCache({ logger })
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('works well for a specific tool version', async () => {
      await cache.initialize()
      await cache.set('foo', 'bar')
      const result = await cache.get('foo')
      assert.strictEqual(result, 'bar')
    })

    it('works well for an object', async () => {
      await cache.initialize()
      await cache.set('foo', { temp: 3 })
      const result = await cache.get('foo')
      assert.strictEqual(result.temp, 3)
    })

    it('returns null for missing entry', async () => {
      await cache.initialize()
      const result = await cache.get('bar')
      assert.strictEqual(result, null)
    })

    it('deletes a key', async () => {
      await cache.initialize()
      await cache.set('foo', 'bar')
      await cache.delete('foo')
      const result = await cache.get('foo')
      assert.strictEqual(result, null)
    })

    it('throws error if redis connection fails', async () => {
      mockClient.connect = () => Promise.reject(new Error('Connection failed'))
      try {
        await cache.initialize()
      } catch (error) {
        assert.strictEqual(error.message, 'Connection failed')
      }
    })

    it('initalizes client only once', async () => {
      await Promise.all([cache.initialize(), cache.initialize()])
      assert.ok(RedisCache.buildRedisClient.calledOnce)
    })

    it('calls client.quit only once', async () => {
      await cache.initialize()
      await Promise.all([cache.done(), cache.done()])
      assert.ok(mockClient.quit.calledOnce)
    })

    it('allows initialization to be retried on error', async () => {
      mockClient.connect = sinon.stub().rejects(new Error('Connection failed')).onSecondCall().resolves(mockClient)
      // First call to initialize will fail
      try {
        await cache.initialize()
        assert.fail('Expected error was not thrown')
      } catch (error) {
        assert.strictEqual(error.message, 'Connection failed')
      }
      // Second call to initialize will succeed
      await cache.initialize()
      // Verify that the client was built twice
      assert.ok(cache.client)
      assert.ok(RedisCache.buildRedisClient.calledTwice)
      assert.ok(mockClient.connect.calledTwice)
    })
  })

  describe('backward compatibility (pako 1.x -> pako 2.x)', () => {
    const objectPrefix = '*!~%'
    let mockClient, cache
    const store = {}

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
      cache = redisCache({ logger })
    })

    afterEach(function () {
      sandbox.restore()
      // Clear store
      Object.keys(store).forEach(key => delete store[key])
    })

    describe('Format Detection', () => {
      it('should detect old binary string format correctly', () => {
        const oldData = 'xÚ+JMÉ,V°ª5´³0²ä\u0002\u0000\u0011î\u0003ê'
        const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(oldData)
        assert.strictEqual(isBase64, false)
      })

      it('should detect new base64 format correctly', () => {
        const newData = 'eJwrSszLLEnVUUpKLAIAESID6g=='
        const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(newData)
        assert.strictEqual(isBase64, true)
      })
    })

    describe('Reading OLD format data (pako 1.x binary string)', () => {
      it('should read definition data (def_* key pattern)', async () => {
        await cache.initialize()

        const originalValue = {
          coordinates: {
            type: 'nuget',
            provider: 'nuget',
            namespace: null,
            name: 'xunit.core',
            revision: '2.1.0'
          },
          described: {
            releaseDate: '2015-11-08T00:00:00.000Z',
            urls: {
              registry: 'https://www.nuget.org/packages/xunit.core/2.1.0',
              download: 'https://www.nuget.org/api/v2/package/xunit.core/2.1.0'
            }
          },
          licensed: {
            declared: 'Apache-2.0 OR MIT'
          },
          files: 87,
          _meta: {
            schemaVersion: '1.6.1',
            updated: '2015-11-08T12:00:00.000Z'
          }
        }

        const serialized = objectPrefix + JSON.stringify(originalValue)

        // compress with pako v1.x using binary string format (old format)
        const oldFormatData = pako1.deflate(serialized, { to: 'string' })

        // verify it's NOT base64 (binary string format)
        assert.strictEqual(/^[A-Za-z0-9+/]+=*$/.test(oldFormatData), false)

        store['def_nuget/nuget/-/xunit.core/2.1.0'] = oldFormatData

        // read with NEW code (uses pako v2.x with format detection)
        const result = await cache.get('def_nuget/nuget/-/xunit.core/2.1.0')

        assert.deepStrictEqual(result, originalValue)
        assert.strictEqual(result.coordinates.name, 'xunit.core')
        assert.strictEqual(result.licensed.declared, 'Apache-2.0 OR MIT')
      })

      it('should read harvest data (hrv_* key pattern)', async () => {
        await cache.initialize()

        const originalValue = [
          {
            type: 'component',
            url: 'cd:/pypi/pypi/-/backports.ssl_match_hostname/3.7.0.2'
          }
        ]

        const serialized = objectPrefix + JSON.stringify(originalValue)

        // compress with pako v1.x using binary string format (old format)
        const oldFormatData = pako1.deflate(serialized, { to: 'string' })

        store['hrv_pypi/pypi/-/backports.ssl_match_hostname/3.7.0.2'] = oldFormatData

        // read with NEW code (uses pako v2.x with format detection)
        const result = await cache.get('hrv_pypi/pypi/-/backports.ssl_match_hostname/3.7.0.2')

        assert.deepStrictEqual(result, originalValue)
        assert.strictEqual(result.length, 1)
        assert.strictEqual(result[0].type, 'component')
        assert.strictEqual(result[0].url, 'cd:/pypi/pypi/-/backports.ssl_match_hostname/3.7.0.2')
      })
    })

    describe('Reading NEW format data (pako 2.x base64)', () => {
      it('should read definition data (def_* key pattern)', async () => {
        await cache.initialize()

        const originalValue = {
          coordinates: {
            type: 'npm',
            provider: 'npmjs',
            namespace: null,
            name: 'lodash',
            revision: '4.17.21'
          },
          described: {
            releaseDate: '2021-02-20T00:00:00.000Z',
            urls: {
              registry: 'https://www.npmjs.com/package/lodash',
              download: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz'
            }
          },
          licensed: {
            declared: 'MIT'
          },
          files: 1054,
          _meta: {
            schemaVersion: '1.6.1',
            updated: '2021-02-20T12:00:00.000Z'
          }
        }

        const serialized = objectPrefix + JSON.stringify(originalValue)

        // compress with pako v2.x using base64 format (new format)
        const deflated = pako2.deflate(serialized)
        const newFormatData = Buffer.from(deflated).toString('base64')

        // verify it IS base64
        assert.strictEqual(/^[A-Za-z0-9+/]+=*$/.test(newFormatData), true)

        store['def_npm/npmjs/-/lodash/4.17.21'] = newFormatData

        // read with NEW code (uses pako v2.x with format detection)
        const result = await cache.get('def_npm/npmjs/-/lodash/4.17.21')

        assert.deepStrictEqual(result, originalValue)
        assert.strictEqual(result.coordinates.name, 'lodash')
        assert.strictEqual(result.licensed.declared, 'MIT')
      })

      it('should read harvest data (hrv_* key pattern)', async () => {
        await cache.initialize()

        const originalValue = [
          { type: 'component', url: 'cd:/npm/npmjs/-/express/4.18.0' },
          { type: 'component', url: 'cd:/npm/npmjs/-/axios/1.6.0' }
        ]

        const serialized = objectPrefix + JSON.stringify(originalValue)

        // compress with pako v2.x using base64 format (new format)
        const deflated = pako2.deflate(serialized)
        const newFormatData = Buffer.from(deflated).toString('base64')

        store['hrv_npm/npmjs/-/my-package/1.0.0'] = newFormatData

        // read with NEW code (uses pako v2.x with format detection)
        const result = await cache.get('hrv_npm/npmjs/-/my-package/1.0.0')

        assert.deepStrictEqual(result, originalValue)
        assert.strictEqual(result.length, 2)
        assert.strictEqual(result[0].url, 'cd:/npm/npmjs/-/express/4.18.0')
      })
    })
  })
  xdescribe('Integration Test', () => {
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

      it('sets value and expires', async () => {
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
