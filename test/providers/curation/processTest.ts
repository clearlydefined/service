import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach, mock } from 'node:test'
// @ts-nocheck
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import process from '../../../providers/curation/process.js'
import memoryQueue from '../../../providers/queueing/memoryQueue.js'

describe('Curation queue processing', () => {
  let clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
  })

  it('handles opened message', async () => {
    const { queue, curationService, logger } = setup({ action: 'opened' })
    const promise = process(queue, curationService, logger, true)
    await clock.runAllAsync()
    await promise

    assert.strictEqual(curationService.getContributedCurations.mock.callCount() === 1, true)
    assert.strictEqual(curationService.validateContributions.mock.callCount() === 1, true)
    assert.strictEqual(curationService.updateContribution.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0], 'Handled GitHub event "opened" for PR#1')
    assert.strictEqual(queue.data.length, 0)
  })

  it('handles synchronize message', async () => {
    const { queue, curationService, logger } = setup({ action: 'synchronize' })
    const promise = process(queue, curationService, logger, true)
    await clock.runAllAsync()
    await promise

    assert.strictEqual(curationService.getContributedCurations.mock.callCount() === 1, true)
    assert.strictEqual(curationService.validateContributions.mock.callCount() === 1, true)
    assert.strictEqual(curationService.updateContribution.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0], 'Handled GitHub event "synchronize" for PR#1')
    assert.strictEqual(queue.data.length, 0)
  })

  it('handles closed message', async () => {
    const { queue, curationService, logger } = setup({ action: 'closed' })
    const promise = process(queue, curationService, logger, true)
    await clock.runAllAsync()
    await promise

    assert.strictEqual(curationService.getContributedCurations.mock.callCount() === 1, false)
    assert.strictEqual(curationService.validateContributions.mock.callCount() === 1, false)
    assert.strictEqual(curationService.addByMergedCuration.mock.callCount() === 1, true)
    expect(curationService.addByMergedCuration.calledBefore(curationService.updateContribution))
    assert.strictEqual(curationService.updateContribution.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0], 'Handled GitHub event "closed" for PR#1')
    assert.strictEqual(queue.data.length, 0)
  })

  it('skips processing for random messages', async () => {
    const { queue, curationService, logger } = setup({ action: 'rando' })
    await process(queue, curationService, logger, true)

    assert.strictEqual(curationService.getContributedCurations.mock.callCount() === 1, false)
    assert.strictEqual(curationService.validateContributions.mock.callCount() === 1, false)
    assert.strictEqual(curationService.updateContribution.mock.callCount() === 1, false)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0], 'Handled GitHub event "rando" for PR#1')
    assert.strictEqual(queue.data.length, 0)
  })
})

function setup({ action, merged }) {
  const queue = memoryQueue()

  queue.queue(
    JSON.stringify({
      action,
      pull_request: {
        number: 1,
        title: 'test pr',
        merged: !!merged,
        head: {
          ref: 'changes',
          sha: '24'
        }
      }
    })
  )

  const curationService = {
    getContributedCurations: mock.fn(),
    validateContributions: mock.fn(),
    updateContribution: mock.fn(),
    addByMergedCuration: mock.fn()
  }
  const logger = {
    info: mock.fn(),
    error: mock.fn()
  }

  return { queue, curationService, logger }
}
