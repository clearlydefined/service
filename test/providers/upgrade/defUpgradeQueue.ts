import assert from 'node:assert/strict'
import { describe, it, beforeEach, mock } from 'node:test'
// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT



import DefinitionQueueUpgrader from '../../../providers/upgrade/defUpgradeQueue.js'
import MemoryQueue from '../../../providers/upgrade/memoryQueueConfig.js'

describe('DefinitionQueueUpgrader', () => {
  let logger
  beforeEach(() => {
    logger = { debug: mock.fn(), error: mock.fn() }
  })

  describe('Unit tests', () => {
    const definition = { coordinates: 'test', _meta: { schemaVersion: '1.0.0' } }
    let queue
    let upgrader

    beforeEach(async () => {
      queue = {
        queue: mock.fn().resolves(),
        initialize: mock.fn().resolves()
      }
      const queueFactory = mock.fn(() => queue)
      upgrader = new DefinitionQueueUpgrader({ logger, queue: queueFactory })
    })

    it('returns an instance of DefinitionQueueUpgrader', () => {
      expect(upgrader).to.be.an.instanceOf(DefinitionQueueUpgrader)
    })

    it('sets and gets current schema version', () => {
      upgrader.currentSchema = '1.0.0'
      assert.strictEqual(upgrader.currentSchema, '1.0.0')
    })

    it('initializes', async () => {
      await upgrader.initialize()
      assert.strictEqual(queue.initialize.mock.callCount() === 1, true)
    })

    it('connects to queue after setupProcessing', async () => {
      await upgrader.initialize()
      const definitionService = { currentSchema: '1.0.0' }
      queue.dequeueMultiple = mock.fn(async () => [])
      upgrader.setupProcessing(definitionService, logger, true)
      assert.strictEqual(queue.dequeueMultiple.mock.callCount() === 1, true)
    })

    context('validate', () => {
      it('fails if current schema version is not set', async () => {
        await expect(upgrader.validate(definition)).to.be.rejectedWith(Error)
      })

      it('fails if it is not initialized', async () => {
        upgrader.currentSchema = '1.0.0'
        const stale = { coordinates: 'test', _meta: { schemaVersion: '0.0.1' } }
        await expect(upgrader.validate(stale)).to.be.rejectedWith(Error)
      })
    })

    context('validate after set up', () => {
      beforeEach(async () => {
        await upgrader.initialize()
        upgrader.currentSchema = '1.0.0'
      })

      it('does not queue null definition', async () => {
        const result = await upgrader.validate(null)
        assert.ok(!result)
        assert.strictEqual(queue.queue.mock.callCount() > 0, false)
      })

      it('does not queue an up-to-date definition', async () => {
        const definition = { coordinates: 'test', _meta: { schemaVersion: '1.0.0' } }
        const result = await upgrader.validate(definition)
        assert.deepStrictEqual(result, definition)
        assert.strictEqual(queue.queue.mock.callCount() > 0, false)
      })

      it('queues and returns a stale definition', async () => {
        const definition = { coordinates: 'test', _meta: { schemaVersion: '0.0.1' } }
        const result = await upgrader.validate(definition)
        assert.deepStrictEqual(result, definition)
        assert.strictEqual(queue.queue.mock.callCount() === 1, true)
      })

      it('logs erorr when queueing throws', async () => {
        const staleDef = {
          coordinates: {
            type: 'npm',
            provider: 'npmjs',
            name: 'lodash',
            revision: '4.17.11'
          },
          _meta: { schemaVersion: '0.0.1' }
        }
        queue.queue.rejects(new Error('test'))
        const result = await upgrader.validate(staleDef)
        assert.deepStrictEqual(result, staleDef)
        assert.strictEqual(logger.error.mock.callCount() === 1, true)
        const { coordinates } = logger.error.mock.calls[0].arguments[1]
        assert.strictEqual(coordinates, 'npm/npmjs/-/lodash/4.17.11')
      })
    })
  })

  describe('Integration tests', () => {
    let queue
    let upgrader

    beforeEach(async () => {
      queue = MemoryQueue()
      upgrader = new DefinitionQueueUpgrader({ logger, queue: mock.fn(() => queue) })
      await upgrader.initialize()
      upgrader.currentSchema = '1.0.0'
    })

    it('queues the correct message that can be decoded correctly', async () => {
      const staleDef = {
        coordinates: {
          type: 'npm',
          provider: 'npmjs',
          name: 'lodash',
          revision: '4.17.11'
        },
        _meta: { schemaVersion: '0.0.1' }
      }
      const result = await upgrader.validate(staleDef)
      assert.deepStrictEqual(result, staleDef)
      assert.strictEqual(queue.data.length, 1)

      const message = await queue.dequeue()
      const coordinates = message.data.coordinates
      assert.deepStrictEqual(coordinates, staleDef.coordinates)
    })
  })
})
