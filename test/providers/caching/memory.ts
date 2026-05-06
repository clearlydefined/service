// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert'
import sinon from 'sinon'
import memoryCacheFactory from '../../../providers/caching/memory.ts'

describe('MemoryCache', () => {
  describe('setIfAbsent', () => {
    let cache: ReturnType<typeof memoryCacheFactory>

    beforeEach(() => {
      cache = memoryCacheFactory()
    })

    it('returns true and stores value when key is absent', () => {
      const result = cache.setIfAbsent('lock_key', '1', 120)
      assert.strictEqual(result, true)
      assert.strictEqual(cache.get('lock_key'), '1')
    })

    it('returns false when key already exists', () => {
      cache.setIfAbsent('lock_key', '1', 120)
      const result = cache.setIfAbsent('lock_key', '1', 120)
      assert.strictEqual(result, false)
    })

    it('does not overwrite existing value', () => {
      cache.setIfAbsent('lock_key', 'first', 120)
      cache.setIfAbsent('lock_key', 'second', 120)
      assert.strictEqual(cache.get('lock_key'), 'first')
    })

    it('different keys are independent', () => {
      const r1 = cache.setIfAbsent('key1', '1', 120)
      const r2 = cache.setIfAbsent('key2', '1', 120)
      assert.strictEqual(r1, true)
      assert.strictEqual(r2, true)
    })

    it('returns true again after TTL expiry (fake timers)', () => {
      const clock = sinon.useFakeTimers()
      try {
        const timedCache = memoryCacheFactory()
        timedCache.setIfAbsent('lock_key', '1', 5)
        assert.strictEqual(timedCache.get('lock_key'), '1')

        clock.tick(5001)

        assert.strictEqual(timedCache.get('lock_key'), null)
        const result = timedCache.setIfAbsent('lock_key', '1', 5)
        assert.strictEqual(result, true)
      } finally {
        clock.restore()
      }
    })

    it('returns false before TTL expiry (fake timers)', () => {
      const clock = sinon.useFakeTimers()
      try {
        const timedCache = memoryCacheFactory()
        timedCache.setIfAbsent('lock_key', '1', 5)

        clock.tick(4999)

        const result = timedCache.setIfAbsent('lock_key', '1', 5)
        assert.strictEqual(result, false)
      } finally {
        clock.restore()
      }
    })
  })
})
