import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach, mock } from 'node:test'
// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

describe('crawlerConfig.serviceFactory (TTL cases)', () => {
  const sandbox = sinon.createSandbox()
  let crawlerStub
  let cacheBasedCrawlerStub

  beforeEach(() => {
    crawlerStub = sandbox.stub().callsFake(() => ({}))
    cacheBasedCrawlerStub = sandbox.stub().callsFake(opts => ({ received: opts }))
  })

  afterEach(() => {
    sandbox.restore()
  })

  // Minimal helpers
  function loadServiceFactory(configGetImpl) {
    return proxyquire('../../../providers/harvest/crawlerConfig', {
      './crawler': crawlerStub,
      './cacheBasedCrawler': cacheBasedCrawlerStub,
      'painless-config': { get: configGetImpl }
    })
  }

  function mappingGet(map) {
    return sandbox.spy(key => map[key])
  }

  it('reads required config keys', () => {
    const configGet = mappingGet({
      CRAWLER_API_AUTH_TOKEN: 'token123',
      CRAWLER_API_URL: 'http://crawler',
      HARVEST_CACHE_TTL_IN_SECONDS: '120'
    })
    const serviceFactory = loadServiceFactory(configGet)
    const result = serviceFactory({ extra: 'value' })

    // Keys fetched
    assert.strictEqual(configGet.mock.callCount(), 3)
    for (const k of ['CRAWLER_API_AUTH_TOKEN', 'CRAWLER_API_URL', 'HARVEST_CACHE_TTL_IN_SECONDS']) {
      assert.ok(configGet.calledWith(k))
    }

    // Wrapper received TTL and harvester
    assert.strictEqual(result.received.cacheTTLInSeconds, 120)
    assert.ok(result.received.harvester)
  })
  for (const { name, envTTL, expected } of [
    { name: 'valid integer', envTTL: '120', expected: 120 },
    { name: 'missing', envTTL: undefined, expected: undefined },
    { name: 'non-numeric', envTTL: 'abc', expected: undefined },
    { name: 'zero', envTTL: '0', expected: undefined },
    { name: 'negative', envTTL: '-5', expected: undefined },
    { name: 'decimal truncated', envTTL: '10.9', expected: 10 }
  ]) {
    it(`TTL case: ${name}`, () => {
      const configGet = mappingGet({
        CRAWLER_API_AUTH_TOKEN: 'token123',
        CRAWLER_API_URL: 'http://crawler',
        HARVEST_CACHE_TTL_IN_SECONDS: envTTL
      })
      const serviceFactory = loadServiceFactory(configGet)
      const result = serviceFactory()

      // Only assert TTL behavior and harvester presence to keep tests minimal
      assert.strictEqual(result.received.cacheTTLInSeconds, expected)
      assert.ok(result.received.harvester)
      assert.ok(cacheBasedCrawlerStub.mock.callCount() === 1)
      assert.ok(crawlerStub.mock.callCount() === 1)
    })
  }
})
