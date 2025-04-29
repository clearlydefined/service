// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const sinon = require('sinon')
const cacheBasedHarvester = require('../../../providers/harvest/cacheBasedCrawler')

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
    debug: sinon.stub(),
    error: sinon.stub()
  }

  let cacheMock, crawler, harvesterMock

  beforeEach(() => {
    harvesterMock = {
      harvest: sinon.stub(),
      toHarvestItem: sinon.stub().callsFake(entry => entry)
    }

    cacheMock = createCacheMock()
    sinon.spy(cacheMock, 'get')
    sinon.spy(cacheMock, 'set')
    sinon.spy(cacheMock, 'delete')

    crawler = cacheBasedHarvester({
      cachingService: cacheMock,
      harvester: harvesterMock,
      logger: loggerMock
    })
  })

  describe('harvest', () => {
    const spec = [foo, bar]

    it('calls harvester with correct parameters', async () => {
      await crawler.harvest(spec, false)
      assert.strictEqual(cacheMock.set.callCount, 2, 'set should be called twice')
      assert.ok(harvesterMock.harvest.calledOnce, 'harvest should be called once')
      assert.deepStrictEqual(
        harvesterMock.harvest.args[0][0],
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
      assert.strictEqual(cacheMock.set.callCount, 1, 'set should be called once')
      assert.ok(harvesterMock.harvest.calledOnce, 'harvest should be called once')
      assert.deepStrictEqual(
        harvesterMock.harvest.args[0][0],
        [foo],
        'Expected harvester to be called with the correct entries'
      )
    })

    it('ignores tracked entries and calls harvester', async () => {
      cacheMock.store[cacheKeyFoo] = [foo]
      await crawler.harvest(spec, false)
      assert.deepStrictEqual(
        harvesterMock.harvest.args[0][0],
        [bar],
        'Expected harvester to be called with the correct entries'
      )
    })

    it('does not trigger harvest if all entries are filtered out', async () => {
      cacheMock.store[cacheKeyFoo] = [foo]
      cacheMock.store[cacheKeyBar] = [bar]
      await crawler.harvest(spec, false)
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called')
    })

    it('does not call harvester if no entries are provided', async () => {
      await crawler.harvest([], false)
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called')
    })

    it('throws error if harvester throws', async () => {
      harvesterMock.harvest.rejects(new Error('Harvester error'))
      await assert.rejects(async () => {
        await crawler.harvest([foo], false)
      }, 'Expected harvest to throw the harvest errors')
    })

    it('handles errors in cache gracefully', async () => {
      cacheMock.get = sinon.stub().rejects(new Error('Cache error'))
      await assert.doesNotReject(async () => {
        await crawler.isTracked(foo.coordinates)
      }, 'Expected isTracked to handle cache errors gracefully')
    })
  })

  describe('isTracked', () => {
    it('calls cache with the correct parameter', async () => {
      await crawler.isTracked(foo.coordinates)
      assert.ok(cacheMock.get.calledWith(cacheKeyFoo), 'Expected cache get to be called with the correct key')
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
      assert.ok(cacheMock.get.notCalled, 'Expected cache get not to be called')
    })

    it('returns false for undefined', async () => {
      const result = await crawler.isTracked(undefined)
      assert.strictEqual(result, false)
      assert.ok(cacheMock.get.notCalled, 'Expected cache get not to be called')
    })

    it('returns false for empty string', async () => {
      const result = await crawler.isTracked('')
      assert.strictEqual(result, false)
      assert.ok(cacheMock.get.notCalled, 'Expected cache get not to be called')
    })
  })

  describe('done', () => {
    beforeEach(() => {
      cacheMock.store[cacheKeyFoo] = [foo]
    })

    it('call delete with the correct parameters', async () => {
      await crawler.done(foo.coordinates)
      assert.ok(cacheMock.delete.calledWith(cacheKeyFoo))
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
      assert.ok(cacheMock.delete.notCalled, 'Expected cache delete not to be called')
      assert.deepStrictEqual(cacheMock.store[cacheKeyFoo], [foo])
    })

    it('has no effect when deleting a non-existing coordinates', async () => {
      let isBarTracked = await crawler.isTracked(bar.coordinates)
      assert.ok(!isBarTracked, 'Expected cache to not be set for bar')
      await crawler.done(bar.coordinates)
      assert.ok(cacheMock.delete.calledOnce, 'Expected cache delete to be called')
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
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called for null coordinates')
    })

    it('handles empty objects in harvest', async () => {
      await crawler.harvest([{}], false)
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called for empty objects')
    })

    it('handles null coordinates in harvest', async () => {
      await crawler.harvest([null], false)
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called for null coordinates')
    })

    it('handles undefined coordinates in harvest', async () => {
      await crawler.harvest([undefined], false)
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called for undefined coordinates')
    })

    it('handles empty array in harvest', async () => {
      await crawler.harvest([], false)
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called for empty array')
    })
  })
})
