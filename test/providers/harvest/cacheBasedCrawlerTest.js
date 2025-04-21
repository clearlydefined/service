const assert = require('assert')
const sinon = require('sinon')
const cacheBasedHarvester = require('../../../providers/harvest/cacheBasedCrawler')

describe('CacheBasedHarvester', () => {
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
      toUrl: sinon.stub().callsFake(entry => entry.coordinates)
    }

    cacheMock = {
      store: {},
      async get(key) {
        return this.store[key] || false
      },
      async set(key, value) {
        this.store[key] = value
      },
      async delete(key) {
        delete this.store[key]
      }
    }
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
    it('calls harvester with correct entries and adds to cache', async () => {
      const spec = [foo, bar]
      await crawler.harvest(spec, false)

      assert.strictEqual(cacheMock.get.callCount, 2, 'get should be called twice')
      assert.strictEqual(cacheMock.set.callCount, 2, 'set should be called twice')
      assert(harvesterMock.harvest.calledOnce, 'harvest should be called once')
      assert.deepStrictEqual(
        harvesterMock.harvest.args[0][0],
        [foo, bar],
        'Expected harvester to be called with the correct entries'
      )
      // Check if the cache was set correctly
      const isFooTracked = await crawler.isTracked(foo)
      assert.ok(isFooTracked, 'Expected cache to be set for foo')
      assert.strictEqual(cacheMock.store['hrv_pkg/npm/foo/1.0.0'], true, 'Expected cache to be set for foo')
      const isBarTracked = await crawler.isTracked(bar)
      assert.ok(isBarTracked, 'Expected cache to be set for bar')
      assert.strictEqual(cacheMock.store['hrv_pkg/npm/bar/2.0.0'], true, 'Expected cache to be set for bar')
    })

    it('filters out tracked entries and calls harvester', async () => {
      const spec = [foo, bar]
      //filter out first and keep second
      cacheMock.store['hrv_pkg/npm/foo/1.0.0'] = true
      await crawler.harvest(spec, false)

      assert.deepStrictEqual(
        harvesterMock.harvest.args[0][0],
        [bar],
        'Expected harvester to be called with the correct entries'
      )
      //Check if the cache was set correctly
      assert.ok(await crawler.isTracked(foo), 'Expected cache to be set for foo')
      assert.ok(await crawler.isTracked(bar), 'Expected cache to be set for bar')
    })
  })

  describe('isTracked', () => {
    it('returns true if the entry is tracked', async () => {
      cacheMock.store['hrv_pkg/npm/foo/1.0.0'] = true
      const result = await crawler.isTracked(foo)
      assert.strictEqual(result, true, 'Expected entry to be tracked')
      assert(cacheMock.get.calledWith('hrv_pkg/npm/foo/1.0.0'), 'Expected cache get to be called with the correct key')
    })

    it('returns false if the entry is not tracked', async () => {
      const result = await crawler.isTracked(foo)
      assert.strictEqual(result, false)
    })
  })

  describe('done', () => {
    it('deletes the cache for the given coordinates', async () => {
      cacheMock.store['hrv_pkg/npm/foo/1.0.0'] = true
      await crawler.done(foo)

      assert(cacheMock.delete.calledWith('hrv_pkg/npm/foo/1.0.0'))
      assert.strictEqual(cacheMock.store['hrv_pkg/npm/foo/1.0.0'], undefined)
      const isFooTracked = await crawler.isTracked(foo)
      assert.ok(!isFooTracked, 'Expected cache to be deleted for foo')
    })
  })
})
