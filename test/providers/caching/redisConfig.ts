// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert'
import esmock from 'esmock'
import sinon from 'sinon'

describe('redisConfig.serviceFactory', () => {
  const sandbox = sinon.createSandbox()
  let redisStub

  beforeEach(() => {
    redisStub = sandbox.stub().callsFake(opts => ({ ok: true, received: opts }))
  })

  afterEach(() => {
    sandbox.restore()
  })

  // Helpers
  async function loadServiceFactory(configGetImpl) {
    return await esmock.strict('../../../providers/caching/redisConfig.js', {
      '../../../providers/caching/redis.js': redisStub,
      'painless-config': { get: configGetImpl }
    })
  }

  function mappingGet(map) {
    return sandbox.spy(key => map[key])
  }

  function expectRedisCalledWith(expectedOptions, result) {
    assert.ok(redisStub.calledOnce)
    assert.deepStrictEqual(redisStub.firstCall.args[0], expectedOptions)
    assert.deepStrictEqual(result, { ok: true, received: expectedOptions })
  }

  function expectConfigGetCalled(configSpy, keys) {
    assert.strictEqual(configSpy.callCount, keys.length)
    for (const k of keys) {
      assert.ok(configSpy.calledWith(k))
    }
  }

  it('uses provided options only', async () => {
    const configGetStub = sandbox.stub() // should not be called
    const serviceFactory = await loadServiceFactory(configGetStub)

    const providedOptions = { service: 'redis://localhost:6379', apiKey: 'abc123', port: 7777 }
    const result = serviceFactory(providedOptions)

    expectRedisCalledWith(providedOptions, result)
    assert.ok(configGetStub.notCalled)
  })

  it('reads config when options omitted', async () => {
    const configGet = mappingGet({
      CACHING_REDIS_SERVICE: 'redis://example',
      CACHING_REDIS_API_KEY: 'secret-key',
      CACHING_REDIS_PORT: '6380'
    })

    const serviceFactory = await loadServiceFactory(configGet)
    const result = serviceFactory()

    expectConfigGetCalled(configGet, ['CACHING_REDIS_SERVICE', 'CACHING_REDIS_API_KEY', 'CACHING_REDIS_PORT'])

    const expectedOptions = { service: 'redis://example', apiKey: 'secret-key', port: 6380 }
    expectRedisCalledWith(expectedOptions, result)
  })

  it('falls back to default port when CACHING_REDIS_PORT is not provided', async () => {
    const configGet = mappingGet({
      CACHING_REDIS_SERVICE: 'redis://example',
      CACHING_REDIS_API_KEY: 'secret-key'
    })

    const serviceFactory = await loadServiceFactory(configGet)
    const result = serviceFactory()

    expectConfigGetCalled(configGet, ['CACHING_REDIS_SERVICE', 'CACHING_REDIS_API_KEY', 'CACHING_REDIS_PORT'])

    const expectedOptions = { service: 'redis://example', apiKey: 'secret-key', port: 6380 }
    expectRedisCalledWith(expectedOptions, result)
  })
})
