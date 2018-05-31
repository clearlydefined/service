// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const redis = require('redis')
const assert = require('assert')
const redisCache = require('../../../providers/caching/redis')

describe('get a tool result ', () => {
  const store = {}
  beforeEach(function () {
    sandbox.stub(redis, 'createClient').callsFake(() => {
      return {
        get: (key, callback) => callback(null, store[key]),
        set: (key, value, arg, expire, callback) => {
          store[key] = value
          callback(null)
        }
      }
    })
  })

  afterEach(function () {
    sandbox.restore()
  })

  it('works well for a specific tool version', async () => {
    const cache = redisCache(null)
    await cache.set('foo', 'bar')
    const result = await cache.get('foo')
    assert.equal(result, 'bar')
  })
  it('works well for a specific tool version', async () => {
    const cache = redisCache(null)
    await cache.set('foo', { temp: 3 })
    const result = await cache.get('foo')
    assert.equal(result.temp, 3)
  })

  it('works well for a specific tool version', async () => {
    const cache = redisCache(null)
    const result = await cache.get('bar')
    assert.equal(result, null)
  })
})