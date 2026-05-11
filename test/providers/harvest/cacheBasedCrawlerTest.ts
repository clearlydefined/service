// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert'
import sinon from 'sinon'
import cacheBasedHarvester from '../../../providers/harvest/cacheBasedCrawler.ts'
import { createMockLogger } from '../../helpers/mockLogger.ts'

const inflightKey = (coordinates: string): string => `hrv_inflight_${coordinates.toLowerCase()}`

function createCacheMock() {
  return {
    store: {},
    locks: new Set<string>(),
    async get(key) {
      return this.store[key] || []
    },
    async set(key, value) {
      this.store[key] = value
    },
    async setIfAbsentBatch(keys: string[], value: string) {
      const acquired: string[] = []
      for (const key of keys) {
        if (this.locks.has(key)) {
          for (const k of acquired) {
            this.locks.delete(k)
            delete this.store[k]
          }
          return false
        }
        this.locks.add(key)
        this.store[key] = value
        acquired.push(key)
      }
      return true
    },
    async delete(key) {
      this.locks.delete(key)
      delete this.store[key]
    }
  }
}

describe('CacheBasedHarvester', () => {
  const cacheKeyFoo = 'hrv_pkg/npm/foo/1.0.0'
  const cacheKeyBar = 'hrv_pkg/npm/bar/2.0.0'
  const foo = { coordinates: 'pkg/npm/foo/1.0.0' }
  const bar = { coordinates: 'pkg/npm/bar/2.0.0' }

  const loggerMock = createMockLogger()

  let cacheMock
  let crawler
  let harvesterMock

  const createCrawler = (overrides = {}) =>
    cacheBasedHarvester({
      cachingService: cacheMock,
      harvester: harvesterMock,
      logger: loggerMock as any,
      lockRetryDelayMinMs: 1,
      lockRetryDelayMaxMs: 2,
      lockAcquireTimeoutMs: 100,
      localLockRetryDelayMs: 1,
      localLockTimeoutBufferMs: 0,
      ...overrides
    })

  const addHarvesterDelay = (delayMs = 15) => {
    harvesterMock.harvest.callsFake(async () => {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    })
  }

  beforeEach(() => {
    harvesterMock = {
      harvest: sinon.stub(),
      toHarvestItem: sinon.stub().callsFake(entry => entry)
    }

    cacheMock = createCacheMock()
    sinon.spy(cacheMock, 'get')
    sinon.spy(cacheMock, 'set')
    sinon.spy(cacheMock, 'delete')

    crawler = createCrawler()
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

    it('skips lock acquisition entirely when pre-filter removes all entries', async () => {
      const setIfAbsentBatchSpy = sinon.spy(cacheMock, 'setIfAbsentBatch')
      cacheMock.store[cacheKeyFoo] = [foo]
      cacheMock.store[cacheKeyBar] = [bar]
      await crawler.harvest(spec, false)
      assert.ok(harvesterMock.harvest.notCalled, 'Expected harvester not to be called')
      assert.ok(setIfAbsentBatchSpy.notCalled, 'Expected no Redis lock acquisition when pre-filter removes all entries')
      assert.strictEqual(crawler._localInflightKeys.size, 0, 'Expected local inflight table to remain empty')
    })

    it('acquires locks only for untracked entries after pre-filter', async () => {
      const setIfAbsentBatchSpy = sinon.spy(cacheMock, 'setIfAbsentBatch')
      const localAcquireSpy = sinon.spy(crawler, '_acquireSortedLocalInflightKeys')
      cacheMock.store[cacheKeyFoo] = [foo]
      await crawler.harvest(spec, false)
      const expectedKey = inflightKey(bar.coordinates)
      assert.strictEqual(setIfAbsentBatchSpy.callCount, 1, 'setIfAbsentBatch should be called once (for bar only)')
      assert.deepStrictEqual(
        setIfAbsentBatchSpy.getCall(0).args[0],
        [expectedKey],
        'Expected Redis lock batch to contain only the untracked entry key'
      )
      assert.deepStrictEqual(
        localAcquireSpy.getCall(0).args[0],
        [expectedKey],
        'Expected local lock acquisition to contain only the untracked entry key'
      )
      assert.deepStrictEqual(
        harvesterMock.harvest.args[0][0],
        [bar],
        'Expected harvester to be called with only the untracked entry'
      )
    })

    it('uses configured concurrency for outer pre-filter and leaves in-lock recheck unthrottled', async () => {
      crawler = createCrawler({ concurrencyLimit: 7 })
      const filterSpy = sinon.spy(crawler, '_filterOutTracked')
      cacheMock.store[cacheKeyFoo] = [foo]

      await crawler.harvest(spec, false)

      // Fixture expectation: foo is pre-tracked, so pre-filter returns [bar] and in-lock recheck still runs.
      assert.strictEqual(filterSpy.callCount, 2, 'Expected pre-filter and in-lock recheck calls')
      assert.deepStrictEqual(filterSpy.getCall(0).args[0], spec, 'Expected outer pre-filter call with original spec')
      assert.deepStrictEqual(
        filterSpy.getCall(1).args[0],
        [bar],
        'Expected in-lock recheck call with candidate entries'
      )
      assert.strictEqual(filterSpy.getCall(0).args[1], 7, 'Expected outer pre-filter to use configured concurrency')
      assert.strictEqual(filterSpy.getCall(1).args[1], undefined, 'Expected in-lock recheck to remain unthrottled')
    })

    it('releases inflight locks only for candidate entries after pre-filter', async () => {
      const deleteSpy = cacheMock.delete
      cacheMock.store[cacheKeyFoo] = [foo]

      await crawler.harvest(spec, false)

      assert.ok(deleteSpy.calledWith(inflightKey(bar.coordinates)), 'Expected inflight lock release for untracked bar')
      assert.ok(
        deleteSpy.neverCalledWith(inflightKey(foo.coordinates)),
        'Expected no inflight lock release for pre-filtered foo'
      )
      assert.strictEqual(deleteSpy.callCount, 1, 'Expected exactly one inflight lock release')
    })

    it('proceeds through pre-filter and dispatches harvest when cache.get throws', async () => {
      cacheMock.get = sinon.stub().rejects(new Error('Cache read error'))
      await assert.doesNotReject(() => crawler.harvest([foo], false))
      assert.ok(harvesterMock.harvest.calledOnce, 'Expected harvest to proceed when pre-filter cache reads fail')
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

      assert.ok(
        cacheMock.delete.calledWith(inflightKey(foo.coordinates)),
        'Expected inflight lock to be released after failure'
      )
      assert.ok(!cacheMock.locks.has(inflightKey(foo.coordinates)), 'Expected no inflight lock to remain after failure')
    })

    it('handles errors in cache gracefully', async () => {
      cacheMock.get = sinon.stub().rejects(new Error('Cache error'))
      await assert.doesNotReject(async () => {
        await crawler.isTracked(foo.coordinates)
      }, 'Expected isTracked to handle cache errors gracefully')
    })

    it('serializes concurrent requests for same coordinate', async () => {
      addHarvesterDelay()

      await Promise.all([crawler.harvest([foo], false), crawler.harvest([foo], false)])

      assert.strictEqual(harvesterMock.harvest.callCount, 1, 'Expected only one harvest call for same coordinate')
    })

    it('does not deadlock for opposite coordinate order requests', async () => {
      addHarvesterDelay()

      await Promise.all([crawler.harvest([foo, bar], false), crawler.harvest([bar, foo], false)])

      assert.strictEqual(
        harvesterMock.harvest.callCount,
        1,
        'Expected one effective harvest due tracked dedup after lock'
      )
    })

    it('acquires inflight locks in sorted key order through harvest', async () => {
      sinon.spy(cacheMock, 'setIfAbsentBatch')

      await crawler.harvest([bar, foo], false)

      const sortedKeys = [inflightKey(foo.coordinates), inflightKey(bar.coordinates)].sort()
      assert.deepStrictEqual(
        cacheMock.setIfAbsentBatch.getCall(0).args[0],
        sortedKeys,
        'setIfAbsentBatch should be called with keys in sorted order'
      )
    })

    it('normalizes inflight key casing through harvest', async () => {
      const mixedCase = { coordinates: 'NPM/npmjs/-/LODASH/4.0.0' }
      sinon.spy(cacheMock, 'setIfAbsentBatch')

      await crawler.harvest([mixedCase], false)

      assert.deepStrictEqual(cacheMock.setIfAbsentBatch.getCall(0).args[0], ['hrv_inflight_npm/npmjs/-/lodash/4.0.0'])
    })

    it('releases partially acquired locks before retrying', async () => {
      const [firstKey, secondKey] = [inflightKey(foo.coordinates), inflightKey(bar.coordinates)].sort()

      cacheMock.locks.add(secondKey)
      setTimeout(() => {
        cacheMock.locks.delete(secondKey)
      }, 10)

      await crawler.harvest([foo, bar], false)

      assert.ok(cacheMock.delete.calledWith(firstKey), 'Expected first lock to be released after initial miss')
      assert.ok(!cacheMock.locks.has(firstKey), 'Expected first lock to be released at end of harvest')
      assert.ok(!cacheMock.locks.has(secondKey), 'Expected second lock to be released at end of harvest')
    })

    it('throws when lock acquisition exceeds timeout', async () => {
      const keyFoo = inflightKey(foo.coordinates)
      cacheMock.locks.add(keyFoo)

      await assert.rejects(async () => {
        await crawler.harvest([foo], false)
      }, /Timed out acquiring inflight harvest coordinate locks/)

      assert.strictEqual(crawler._localInflightKeys.size, 0, 'Expected local inflight table to be fully released')
      assert.strictEqual(
        cacheMock.locks.size,
        1,
        'Only the seeded key should remain in Redis — no locks leaked by harvest'
      )
    })

    it('times out cleanly when one key is held throughout, leaving no leaked locks', async () => {
      const [firstKey, secondKey] = [inflightKey(foo.coordinates), inflightKey(bar.coordinates)].sort()
      cacheMock.locks.add(secondKey)

      await assert.rejects(async () => {
        await crawler.harvest([foo, bar], false)
      }, /Timed out acquiring inflight harvest coordinate locks/)

      assert.ok(!cacheMock.locks.has(firstKey), 'No lock should remain for first key after timeout')
      assert.ok(cacheMock.locks.has(secondKey), 'Seeded second key should remain (held by another requester)')
      assert.strictEqual(crawler._localInflightKeys.size, 0, 'Local locks should be fully released after timeout')
    })

    it('emits a warn log when lock acquisition times out', async () => {
      loggerMock.warn.resetHistory()
      const keyFoo = inflightKey(foo.coordinates)
      cacheMock.locks.add(keyFoo)

      await assert.rejects(async () => {
        await crawler.harvest([foo], false)
      }, /Timed out acquiring inflight harvest coordinate locks/)

      assert.ok(loggerMock.warn.calledOnce, 'Expected exactly one warn log on timeout')
      assert.ok(
        loggerMock.warn.firstCall.args[0].includes('Timed out acquiring'),
        'Expected warn message to mention timeout'
      )
    })

    it('uses fixed retry delay when min equals max', async () => {
      const fixedDelayMs = 7
      const keyFoo = inflightKey(foo.coordinates)
      cacheMock.locks.add(keyFoo)

      const crawlerWithFixedDelay = createCrawler({
        lockRetryDelayMinMs: fixedDelayMs,
        lockRetryDelayMaxMs: fixedDelayMs,
        lockAcquireTimeoutMs: 40
      })

      sinon.spy(cacheMock, 'setIfAbsentBatch')
      const clock = sinon.useFakeTimers()
      try {
        const pending = crawlerWithFixedDelay.harvest([foo], false)
        const rejection = assert.rejects(pending, /Timed out acquiring inflight harvest coordinate locks/)
        await clock.tickAsync(100)
        await rejection

        assert.ok(
          cacheMock.setIfAbsentBatch.callCount >= 2,
          'Expected multiple lock attempts while retrying with fixed delay before timing out'
        )
      } finally {
        clock.restore()
      }
    })

    it('releases all keys when setIfAbsentBatch throws', async () => {
      const [firstKey, secondKey] = [inflightKey(foo.coordinates), inflightKey(bar.coordinates)].sort()

      cacheMock.setIfAbsentBatch = sinon.stub().callsFake(async (_keys: string[]) => {
        // Simulate: script acquired some keys server-side before throwing
        cacheMock.locks.add(firstKey)
        throw new Error('Redis unavailable')
      })

      await assert.rejects(async () => {
        await crawler.harvest([foo, bar], false)
      }, /Redis unavailable/)

      assert.ok(cacheMock.delete.calledWith(firstKey), 'Expected all keys to be released on error')
      assert.ok(cacheMock.delete.calledWith(secondKey), 'Expected all keys to be released on error')
    })

    it('releases all keys as safety net when setIfAbsentBatch throws without acquiring any', async () => {
      const [firstKey, secondKey] = [inflightKey(foo.coordinates), inflightKey(bar.coordinates)].sort()

      cacheMock.setIfAbsentBatch = sinon.stub().callsFake(async () => {
        throw new Error('Redis unavailable')
      })

      await assert.rejects(async () => {
        await crawler.harvest([foo, bar], false)
      }, /Redis unavailable/)

      assert.ok(
        cacheMock.delete.calledWith(firstKey),
        'Expected safety release of first key even with no keys acquired'
      )
      assert.ok(
        cacheMock.delete.calledWith(secondKey),
        'Expected safety release of second key even with no keys acquired'
      )
    })

    it('rethrows setIfAbsentBatch error even when safety release also fails', async () => {
      const [firstKey] = [inflightKey(foo.coordinates), inflightKey(bar.coordinates)].sort()

      cacheMock.setIfAbsentBatch = sinon.stub().callsFake(async () => {
        throw new Error('Redis unavailable')
      })

      cacheMock.delete = sinon.stub().callsFake(async key => {
        if (key === firstKey) {
          throw new Error('Release failed')
        }
        cacheMock.locks.delete(key)
      })

      await assert.rejects(async () => {
        await crawler.harvest([foo, bar], false)
      }, /Redis unavailable/)
    })

    it('processes independent coordinates concurrently without blocking each other', async () => {
      await Promise.all([crawler.harvest([foo], false), crawler.harvest([bar], false)])

      assert.strictEqual(harvesterMock.harvest.callCount, 2, 'Both independent coordinates should be harvested')
      const harvested = harvesterMock.harvest.args.map(([entries]) => entries[0].coordinates)
      assert.ok(harvested.includes(foo.coordinates), 'Expected foo to be harvested')
      assert.ok(harvested.includes(bar.coordinates), 'Expected bar to be harvested')
    })

    it('resolves normally and releases inflight locks when tracking fails', async () => {
      cacheMock.set = sinon.stub().rejects(new Error('Cache write error'))

      await assert.doesNotReject(() => crawler.harvest([foo], false))

      const keyFoo = inflightKey(foo.coordinates)
      assert.ok(cacheMock.delete.calledWith(keyFoo), 'Expected inflight lock released after swallowed tracking error')
      assert.ok(!cacheMock.locks.has(keyFoo), 'Expected no inflight lock to remain after swallowed tracking error')
      assert.strictEqual(crawler._localInflightKeys.size, 0, 'Expected local inflight table to be fully released')
    })

    it('throws when local lock acquisition exceeds timeout', async () => {
      const keyFoo = inflightKey(foo.coordinates)
      crawler._localInflightKeys.add(keyFoo)
      sinon.spy(cacheMock, 'setIfAbsentBatch')

      await assert.rejects(
        () => crawler.harvest([foo], false),
        /Timed out acquiring local inflight harvest coordinate locks/
      )

      assert.ok(
        cacheMock.setIfAbsentBatch.notCalled,
        'Redis setIfAbsentBatch should not be called when local times out'
      )
      assert.strictEqual(
        crawler._localInflightKeys.size,
        1,
        'Only the pre-seeded key should remain — no extra local keys leaked by harvest'
      )
    })

    it('local gate prevents simultaneous Redis acquire attempts for same-instance concurrent requests', async () => {
      addHarvesterDelay(15)
      sinon.spy(cacheMock, 'setIfAbsentBatch')

      await Promise.all([crawler.harvest([foo], false), crawler.harvest([foo], false)])

      assert.strictEqual(harvesterMock.harvest.callCount, 1, 'Only one harvest dispatched')
      // With local gate: each request calls setIfAbsentBatch exactly once, no retry contention.
      // Without local gate: requests race at Redis and setIfAbsentBatch is called many more times.
      assert.strictEqual(
        cacheMock.setIfAbsentBatch.callCount,
        2,
        'Each request hits Redis exactly once — local gate prevents simultaneous Redis contention'
      )
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

  describe('_filterOutTracked', () => {
    it('caps parallel tracking checks when concurrency is provided', async () => {
      const entries = Array.from({ length: 6 }, (_, index) => ({ coordinates: `pkg/npm/item/${index}` }))
      let inFlight = 0
      let maxInFlight = 0

      sinon.stub(crawler, '_isTrackedHarvest').callsFake(async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise(resolve => setTimeout(resolve, 5))
        inFlight -= 1
        return false
      })

      const result = await crawler._filterOutTracked(entries, 2)

      assert.strictEqual(result.length, entries.length, 'Expected all entries to pass through when none are tracked')
      assert.ok(maxInFlight <= 2, `Expected max concurrent checks <= 2, got ${maxInFlight}`)
    })

    it('bypasses throat when concurrency is greater than or equal to entry count', async () => {
      const entries = Array.from({ length: 6 }, (_, index) => ({ coordinates: `pkg/npm/item/${index}` }))
      let inFlight = 0
      let maxInFlight = 0

      sinon.stub(crawler, '_isTrackedHarvest').callsFake(async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise(resolve => setTimeout(resolve, 5))
        inFlight -= 1
        return false
      })

      const result = await crawler._filterOutTracked(entries, 10)

      assert.strictEqual(result.length, entries.length, 'Expected all entries to pass through when none are tracked')
      assert.strictEqual(
        maxInFlight,
        entries.length,
        `Expected unthrottled execution when limit >= entries, got ${maxInFlight}`
      )
    })
  })

  describe('_trackHarvests', () => {
    it('runs tracking writes unthrottled', async () => {
      const entries = Array.from({ length: 6 }, (_, index) => ({ coordinates: `pkg/npm/item/${index}` }))
      let inFlight = 0
      let maxInFlight = 0

      sinon.stub(crawler, '_track').callsFake(async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise(resolve => setTimeout(resolve, 5))
        inFlight -= 1
      })

      await assert.doesNotReject(() => crawler._trackHarvests(entries))

      assert.strictEqual(
        maxInFlight,
        entries.length,
        `Expected unthrottled tracking writes, got max concurrency ${maxInFlight}`
      )
    })

    it('logs individual tracking failures and resolves', async () => {
      const entries = [foo, bar]
      const trackError = new Error('Track write failed')

      loggerMock.error.resetHistory()
      sinon.stub(crawler, '_track').callsFake(async (entry: any) => {
        if (entry.coordinates === foo.coordinates) {
          throw trackError
        }
      })

      await assert.doesNotReject(() => crawler._trackHarvests(entries))
      assert.ok(loggerMock.error.calledWith(trackError), 'Expected rejected track operation to be logged')
    })
  })

  describe('_releaseInflightKeys', () => {
    it('logs delete failures and does not throw', async () => {
      const deleteError = new Error('Delete failed')
      const keyFoo = inflightKey(foo.coordinates)
      const keyBar = inflightKey(bar.coordinates)

      loggerMock.error.resetHistory()
      cacheMock.delete = sinon.stub().callsFake(async key => {
        if (key === keyFoo) {
          throw deleteError
        }
      })

      await assert.doesNotReject(() => crawler._releaseInflightKeys([keyFoo, keyBar]))
      assert.ok(
        loggerMock.error.calledWith('Error releasing inflight lock', deleteError),
        'Expected release failure to be logged'
      )
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

    it('resolves and logs when cache.delete throws', async () => {
      cacheMock.delete = sinon.stub().rejects(new Error('Cache error'))

      await assert.doesNotReject(() => crawler.done(foo.coordinates))
      assert.ok(loggerMock.error.called, 'Expected error to be logged')
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
