// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert'
import { beforeEach, describe, it, mock } from 'node:test'
import cacheBasedHarvester from '../../../providers/harvest/cacheBasedCrawler.js'

function createCacheMock() {
  return {
    store: {},
    async get(key) {
      return this.store[key] || []
    },
    async set(key, value) {
      this.store[key] = value
    },
    async delete(key) {
      delete this.store[key]
    }
  }
}

describe('CacheBasedHarvester', () => {
  const cacheKeyFoo = 'hrv_pkg/npm/foo/1.0.0'
  const cacheKeyBar = 'hrv_pkg/npm/bar/2.0.0'
  const foo = { coordinates: 'pkg/npm/foo/1.0.0' }
  const bar = { coordinates: 'pkg/npm/bar/2.0.0' }

  const loggerMock = {
    debug: mock.fn(),
    error: mock.fn()
  }

  let cacheMock
  let crawler
  let harvesterMock

  beforeEach(() => {
    harvesterMock = {
      harvest: mock.fn(),
      toHarvestItem: mock.fn(entry => entry)
    }

    cacheMock = createCacheMock()
    mock.method(cacheMock, 'get')
    mock.method(cacheMock, 'set')
    mock.method(cacheMock, 'delete')

    crawler = cacheBasedHarvester({
      cachingService: cacheMock,
      harvester: harvesterMock,
      logger: loggerMock as any
    })
  })

  describe('harvest', () => {
    const spec = [foo, bar]

    it('calls harvester with correct parameters', async () => {
      await crawler.harvest(spec, false)
      assert.strictEqual(cacheMock.set.mock.callCount(), 2, 'set should be called twice')
      assert.ok(harvesterMock.harvest.mock.callCount() === 1, 'harvest should be called once')
      assert.deepStrictEqual(
        harvesterMock.harvest.mock.calls[0].arguments[0],
        [foo, bar],
        'Expected harvester to be called with the correct entries'
      )
    })

    it('adds to cache after harvest', async () => {
      await crawler.harvest(spec, false)
      const isFooTracked = await crawler.isTracked(foo.coordinates)
      assert.ok(isFooTracked, 'Expected cache to be set for foo')
      const isBarTracked = await crawler.isTracked(bar.coordinates)
      assert.ok(isBarTracked, 'Expected cache to be set for bar')
    })

    it('removes duplicates before harvest', async () => {
      await crawler.harvest([foo, foo], false)
      assert.strictEqual(cacheMock.set.mock.callCount(), 1, 'set should be called once')
      assert.ok(harvesterMock.harvest.mock.callCount() === 1, 'harvest should be called once')
      assert.deepStrictEqual(
        harvesterMock.harvest.mock.calls[0].arguments[0],
        [foo],
        'Expected harvester to be called with the correct entries'
      )
    })

    it('ignores tracked entries and calls harvester', async () => {
      cacheMock.store[cacheKeyFoo] = [foo]
      await crawler.harvest(spec, false)
      assert.deepStrictEqual(
        harvesterMock.harvest.mock.calls[0].arguments[0],
        [bar],
        'Expected harvester to be called with the correct entries'
      )
    })

    it('does not trigger harvest if all entries are filtered out', async () => {
      cacheMock.store[cacheKeyFoo] = [foo]
      cacheMock.store[cacheKeyBar] = [bar]
      await crawler.harvest(spec, false)
      assert.ok(harvesterMock.harvest.mock.callCount() === 0, 'Expected harvester not to be called')
    })

    it('does not call harvester if no entries are provided', async () => {
      await crawler.harvest([], false)
      assert.ok(harvesterMock.harvest.mock.callCount() === 0, 'Expected harvester not to be called')
    })

    it('throws error if harvester throws', async () => {
      harvesterMock.harvest.mock.mockImplementation(async () => {
        throw new Error('Harvester error')
      })
      await assert.rejects(async () => {
        await crawler.harvest([foo], false)
      }, 'Expected harvest to throw the harvest errors')
    })

    it('handles errors in cache gracefully', async () => {
      cacheMock.get = mock.fn(async () => {
        throw new Error('Cache error')
      })
      await assert.doesNotReject(async () => {
        await crawler.isTracked(foo.coordinates)
      }, 'Expected isTracked to handle cache errors gracefully')
    })
  })

  describe('isTracked', () => {
    it('calls cache with the correct parameter', async () => {
      await crawler.isTracked(foo.coordinates)
      assert.deepStrictEqual(cacheMock.get.mock.calls[0].arguments[0], cacheKeyFoo, 'Expected cache get to be called with the correct key')
    })

    it('returns true if the entry is tracked', async () => {
      cacheMock.store[cacheKeyFoo] = [foo]
      const result = await crawler.isTracked(foo.coordinates)
      assert.strictEqual(result, true, 'Expected entry to be tracked')
    })

    it('returns false if the entry is not tracked', async () => {
      const result = await crawler.isTracked(foo.coordinates)
      assert.strictEqual(result, false)
    })

    it('returns false for null', async () => {
      const result = await crawler.isTracked(null)
      assert.strictEqual(result, false)
      assert.ok(cacheMock.get.mock.callCount() === 0, 'Expected cache get not to be called')
    })

    it('returns false for undefined', async () => {
      const result = await crawler.isTracked(undefined)
      assert.strictEqual(result, false)
      assert.ok(cacheMock.get.mock.callCount() === 0, 'Expected cache get not to be called')
    })

    it('returns false for empty string', async () => {
      const result = await crawler.isTracked('')
      assert.strictEqual(result, false)
      assert.ok(cacheMock.get.mock.callCount() === 0, 'Expected cache get not to be called')
    })
  })

  describe('done', () => {
    beforeEach(() => {
      cacheMock.store[cacheKeyFoo] = [foo]
    })

    it('call delete with the correct parameters', async () => {
      await crawler.done(foo.coordinates)
      assert.deepStrictEqual(cacheMock.delete.mock.calls[0].arguments[0], cacheKeyFoo)
    })

    it('deletes the cache for the given coordinates', async () => {
      let isFooTracked = await crawler.isTracked(foo.coordinates)
      assert.ok(isFooTracked, 'Expected cache to be set for foo')
      await crawler.done(foo.coordinates)
      isFooTracked = await crawler.isTracked(foo.coordinates)
      assert.ok(!isFooTracked, 'Expected cache to be deleted for foo')
    })

    it('does not delete the cache for null', async () => {
      await crawler.done(null)
      assert.ok(cacheMock.delete.mock.callCount() === 0, 'Expected cache delete not to be called')
      assert.deepStrictEqual(cacheMock.store[cacheKeyFoo], [foo])
    })

    it('has no effect when deleting a non-existing coordinates', async () => {
      let isBarTracked = await crawler.isTracked(bar.coordinates)
      assert.ok(!isBarTracked, 'Expected cache to not be set for bar')
      await crawler.done(bar.coordinates)
      assert.ok(cacheMock.delete.mock.callCount() === 1, 'Expected cache delete to be called')
      isBarTracked = await crawler.isTracked(bar.coordinates)
      assert.ok(!isBarTracked, 'Expected cache to not be set for bar')
    })
  })

  describe('Edge Cases', () => {
    it('handles non-string coordinates in isTracked', async () => {
      const result = await crawler.isTracked(12345)
      assert.strictEqual(result, false, 'Expected isTracked to return false for non-string coordinates')
    })

    it('handles null spec in harvest', async () => {
      await crawler.harvest(null, false)
      assert.ok(
        harvesterMock.harvest.mock.callCount() === 0,
        'Expected harvester not to be called for null coordinates'
      )
    })

    it('handles empty objects in harvest', async () => {
      await crawler.harvest([{}], false)
      assert.ok(harvesterMock.harvest.mock.callCount() === 0, 'Expected harvester not to be called for empty objects')
    })

    it('handles null coordinates in harvest', async () => {
      await crawler.harvest([null], false)
      assert.ok(
        harvesterMock.harvest.mock.callCount() === 0,
        'Expected harvester not to be called for null coordinates'
      )
    })

    it('handles undefined coordinates in harvest', async () => {
      await crawler.harvest([undefined], false)
      assert.ok(
        harvesterMock.harvest.mock.callCount() === 0,
        'Expected harvester not to be called for undefined coordinates'
      )
    })

    it('handles empty array in harvest', async () => {
      await crawler.harvest([], false)
      assert.ok(harvesterMock.harvest.mock.callCount() === 0, 'Expected harvester not to be called for empty array')
    })
  })
})
