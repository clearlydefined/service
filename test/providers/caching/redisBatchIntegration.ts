// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert'
import { setTimeout as sleep } from 'node:timers/promises'
import { GenericContainer } from 'testcontainers'
import redisCache from '../../../providers/caching/redis.ts'
import { createSilentLogger } from '../../helpers/mockLogger.ts'

const logger = createSilentLogger()
describe('RedisCache setIfAbsentBatch integration', () => {
  let container: any
  let cache: ReturnType<typeof redisCache>

  before(async function () {
    this.timeout(20_000)
    container = await new GenericContainer('redis').withExposedPorts(6379).start()

    cache = redisCache({
      service: container.getHost(),
      port: container.getMappedPort(6379),
      tls: false,
      logger
    }) as any

    await cache.initialize()
  })

  after(async () => {
    await cache?.done()
    await container?.stop()
  })

  it('acquires all keys atomically in one call', async () => {
    const keys = ['batch_lock_a', 'batch_lock_b', 'batch_lock_c']
    const acquired = await cache.setIfAbsentBatch(keys, 'token', 30)

    assert.strictEqual(acquired, true)
    for (const key of keys) {
      const value = await cache.client!.get(key)
      assert.strictEqual(value, 'token')
    }
  })

  it('rolls back partial keys on miss', async () => {
    await cache.client!.set('batch_lock_held', 'held', { EX: 30 })

    const acquired = await cache.setIfAbsentBatch(['batch_lock_first', 'batch_lock_held', 'batch_lock_third'], '1', 30)

    assert.strictEqual(acquired, false)
    assert.strictEqual(await cache.client!.get('batch_lock_first'), null)
    assert.strictEqual(await cache.client!.get('batch_lock_held'), 'held')
    assert.strictEqual(await cache.client!.get('batch_lock_third'), null)
  })

  it('recovers from NOSCRIPT by re-loading and retrying', async () => {
    await cache.client!.sendCommand(['SCRIPT', 'FLUSH'])

    const acquired = await cache.setIfAbsentBatch(['batch_lock_noscript'], '1', 30)

    assert.strictEqual(acquired, true)
    assert.strictEqual(await cache.client!.get('batch_lock_noscript'), '1')
  })

  it('applies TTL to all batch-acquired keys', async () => {
    const keys = ['batch_lock_ttl_a', 'batch_lock_ttl_b']
    const acquired = await cache.setIfAbsentBatch(keys, 'ttl', 1)

    assert.strictEqual(acquired, true)
    assert.strictEqual(await cache.client!.get(keys[0]), 'ttl')
    assert.strictEqual(await cache.client!.get(keys[1]), 'ttl')

    await sleep(1_100)

    assert.strictEqual(await cache.client!.get(keys[0]), null)
    assert.strictEqual(await cache.client!.get(keys[1]), null)
  })

  it('rolls back all preceding keys when last key is already held', async () => {
    const lastKey = 'batch_rollback_last'
    await cache.client!.set(lastKey, 'held', { EX: 30 })

    const acquired = await cache.setIfAbsentBatch(['batch_rollback_a', 'batch_rollback_b', lastKey], '1', 30)

    assert.strictEqual(acquired, false)
    assert.strictEqual(await cache.client!.get('batch_rollback_a'), null, 'first key should be released')
    assert.strictEqual(await cache.client!.get('batch_rollback_b'), null, 'second key should be released')
    assert.strictEqual(await cache.client!.get(lastKey), 'held', 'held key should be untouched')
  })

  it('re-acquires keys after they are released', async () => {
    const keys = ['reacquire_a', 'reacquire_b']

    const first = await cache.setIfAbsentBatch(keys, '1', 30)
    assert.strictEqual(first, true)

    await Promise.all(keys.map(k => cache.client!.del(k)))

    const second = await cache.setIfAbsentBatch(keys, '1', 30)
    assert.strictEqual(second, true)
  })

  it('two concurrent callers: exactly one wins all keys', async () => {
    const keys = ['race_key_a', 'race_key_b', 'race_key_c']

    const cache2 = redisCache({
      service: container.getHost(),
      port: container.getMappedPort(6379),
      tls: false,
      logger
    }) as any
    await cache2.initialize()
    try {
      const [r1, r2] = await Promise.all([
        cache.setIfAbsentBatch(keys, 'caller1', 30),
        cache2.setIfAbsentBatch(keys, 'caller2', 30)
      ])

      assert.ok(r1 !== r2, 'exactly one caller should win')

      const winner = r1 ? 'caller1' : 'caller2'
      for (const key of keys) {
        assert.strictEqual(await cache.client!.get(key), winner, `${key} should be owned by the winner`)
      }
    } finally {
      await cache2.done()
    }
  })
})
