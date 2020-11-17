// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const process = require('../../../providers/curation/process')
const memoryQueue = require('../../../providers/queueing/memoryQueue')
const sinon = require('sinon')

describe('Curation queue processing', () => {
  it('handles opened message', async () => {
    const { queue, curationService, logger } = setup({ action: 'opened' })
    await process(queue, curationService, logger, true)

    expect(curationService.getContributedCurations.calledOnce).to.be.true
    expect(curationService.validateContributions.calledOnce).to.be.true
    expect(curationService.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.getCall(0).args[0]).to.eq('Handled GitHub event "opened" for PR#1')
    expect(queue.data.length).to.eq(0)
  })

  it('handles synchronize message', async () => {
    const { queue, curationService, logger } = setup({ action: 'synchronize' })
    await process(queue, curationService, logger, true)

    expect(curationService.getContributedCurations.calledOnce).to.be.true
    expect(curationService.validateContributions.calledOnce).to.be.true
    expect(curationService.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.getCall(0).args[0]).to.eq('Handled GitHub event "synchronize" for PR#1')
    expect(queue.data.length).to.eq(0)
  })

  it('handles closed message', async () => {
    const { queue, curationService, logger } = setup({ action: 'closed' })
    await process(queue, curationService, logger, true)

    expect(curationService.getContributedCurations.calledOnce).to.be.false
    expect(curationService.validateContributions.calledOnce).to.be.false
    expect(curationService.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.getCall(0).args[0]).to.eq('Handled GitHub event "closed" for PR#1')
    expect(queue.data.length).to.eq(0)
  })

  it('skips processing for random messages', async () => {
    const { queue, curationService, logger } = setup({ action: 'rando' })
    await process(queue, curationService, logger, true)

    expect(curationService.getContributedCurations.calledOnce).to.be.false
    expect(curationService.validateContributions.calledOnce).to.be.false
    expect(curationService.updateContribution.calledOnce).to.be.false
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.getCall(0).args[0]).to.eq('Handled GitHub event "rando" for PR#1')
    expect(queue.data.length).to.eq(0)
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
    getContributedCurations: sinon.stub(),
    validateContributions: sinon.stub(),
    updateContribution: sinon.stub()
  }
  const logger = {
    info: sinon.stub(),
    error: sinon.stub()
  }

  return { queue, curationService, logger }
}
