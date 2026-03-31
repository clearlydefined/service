import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach, mock } from 'node:test'
// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

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
  function loadServiceFactory(configGetImpl) {
    return proxyquire('../../../providers/caching/redisConfig', {
      './redis': redisStub,
      'painless-config': { get: configGetImpl }
    })
  }

  function mappingGet(map) {
    return sandbox.spy(key => map[key])
  }

  function expectRedisCalledWith(expectedOptions, result) {
    assert.ok(redisStub.mock.callCount() === 1)
    assert.deepStrictEqual(redisStub.mock.calls[0].arguments[0], expectedOptions)
    assert.deepStrictEqual(result, { ok: true, received: expectedOptions })
  }

  function expectConfigGetCalled(configSpy, keys) {
    assert.strictEqual(configSpy.mock.callCount(), keys.length)
    for (const k of keys) {
      assert.ok(configSpy.calledWith(k))
    }
  }

  it('uses provided options only', () => {
    const configGetStub = sandbox.stub() // should not be called
    const serviceFactory = loadServiceFactory(configGetStub)

    const providedOptions = { service: 'redis://localhost:6379', apiKey: 'abc123', port: 7777 }
    const result = serviceFactory(providedOptions)

    expectRedisCalledWith(providedOptions, result)
    assert.ok(configGetStub.mock.callCount() === 0)
  })

  it('reads config when options omitted', () => {
    const configGet = mappingGet({
      CACHING_REDIS_SERVICE: 'redis://example',
      CACHING_REDIS_API_KEY: 'secret-key',
      CACHING_REDIS_PORT: '6380'
    })

    const serviceFactory = loadServiceFactory(configGet)
    const result = serviceFactory()

    expectConfigGetCalled(configGet, ['CACHING_REDIS_SERVICE', 'CACHING_REDIS_API_KEY', 'CACHING_REDIS_PORT'])

    const expectedOptions = { service: 'redis://example', apiKey: 'secret-key', port: 6380 }
    expectRedisCalledWith(expectedOptions, result)
  })

  it('falls back to default port when CACHING_REDIS_PORT is not provided', () => {
    const configGet = mappingGet({
      CACHING_REDIS_SERVICE: 'redis://example',
      CACHING_REDIS_API_KEY: 'secret-key'
    })

    const serviceFactory = loadServiceFactory(configGet)
    const result = serviceFactory()

    expectConfigGetCalled(configGet, ['CACHING_REDIS_SERVICE', 'CACHING_REDIS_API_KEY', 'CACHING_REDIS_PORT'])

    const expectedOptions = { service: 'redis://example', apiKey: 'secret-key', port: 6380 }
    expectRedisCalledWith(expectedOptions, result)
  })
})
