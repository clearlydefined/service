import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import process from '../../../providers/harvest/process.js'
import memoryQueue from '../../../providers/queueing/memoryQueue.js'

describe('Harvest queue processing', () => {
  it('handles new message from clearlydefined tool', async () => {
    const { queue, definitionService, logger } = setup(
      'urn:gem:rubygems:-:0mq:revision:0.5.2:tool:clearlydefined:1.3.3'
    )
    await process(queue, definitionService as any, logger as any, true)

    assert.strictEqual(definitionService.computeStoreAndCurate.mock.callCount() === 1, true)
    assert.deepStrictEqual(definitionService.computeStoreAndCurate.mock.calls[0].arguments[0], {
      type: 'gem',
      provider: 'rubygems',
      name: '0mq',
      revision: '0.5.2'
    })
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0], 
      'Handled Crawler update event for urn:gem:rubygems:-:0mq:revision:0.5.2:tool:clearlydefined:1.3.3'
    )
    assert.strictEqual(queue.data.length, 0)
  })

  it('handles new message from non-clearlydefined tool', async () => {
    const { queue, definitionService, logger } = setup(
      'urn:pypi:pypi:-:backports.ssl_match_hostname:revision:3.2a3:tool:scancode:3.2.2'
    )
    await process(queue, definitionService as any, logger as any, true)

    assert.strictEqual(definitionService.computeAndStoreIfNecessary.mock.callCount() === 1, true)
    assert.deepStrictEqual(definitionService.computeAndStoreIfNecessary.mock.calls[0].arguments[0], {
      type: 'pypi',
      provider: 'pypi',
      name: 'backports.ssl_match_hostname',
      revision: '3.2a3'
    })
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0], 
      'Handled Crawler update event for urn:pypi:pypi:-:backports.ssl_match_hostname:revision:3.2a3:tool:scancode:3.2.2'
    )
    assert.strictEqual(queue.data.length, 0)
  })

  it('handles bogus message', async () => {
    const { queue, definitionService, logger } = setup({ junk: 'here' })
    await process(queue, definitionService as any, logger as any, true)
    assert.strictEqual(logger.info.mock.callCount() > 0, false)
    assert.strictEqual(queue.data.length, 1)
  })
})

function setup(urn) {
  const queue = memoryQueue()
  queue.queue(JSON.stringify(createMessage(urn)))
  const definitionService = {
    computeStoreAndCurate: mock.fn(async () => {}),
    computeAndStoreIfNecessary: mock.fn(async () => {})
  }
  const logger = {
    info: mock.fn(),
    error: mock.fn()
  }

  return { queue, definitionService, logger }
}

function createMessage(href) {
  return {
    _metadata: {
      links: {
        self: { href }
      }
    }
  }
}
