// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const process = require('../../../providers/harvest/process')
const memoryQueue = require('../../../providers/queueing/memoryQueue')
const sinon = require('sinon')

describe('Harvest queue processing', () => {
  it('handles new message from clearlydefined tool', async () => {
    const { queue, definitionService, logger } = setup({
      _metadata: { links: { self: { href: 'urn:gem:rubygems:-:0mq:revision:0.5.2:tool:clearlydefined:1.3.3' } } }
    })
    await process(queue, definitionService, logger, true)

    expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
    expect(definitionService.computeStoreAndCurate.getCall(0).args[0]).to.deep.eq({
      type: 'gem',
      provider: 'rubygems',
      name: '0mq',
      revision: '0.5.2'
    })
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.getCall(0).args[0]).to.eq(
      'Handled Crawler update event for urn:gem:rubygems:-:0mq:revision:0.5.2:tool:clearlydefined:1.3.3'
    )
    expect(queue.data.length).to.eq(0)
  })

  it('handles new message from non-clearlydefined tool', async () => {
    const { queue, definitionService, logger } = setup({
      _metadata: { links: { self: { href: 'urn:pypi:pypi:-:backports.ssl_match_hostname:revision:3.2a3:tool:scancode:3.2.2' } } }
    })
    await process(queue, definitionService, logger, true)

    expect(definitionService.computeAndStore.calledOnce).to.be.true
    expect(definitionService.computeAndStore.getCall(0).args[0]).to.deep.eq({
      type: 'pypi',
      provider: 'pypi',
      name: 'backports.ssl_match_hostname',
      revision: '3.2a3'
    })
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.getCall(0).args[0]).to.eq(
      'Handled Crawler update event for urn:pypi:pypi:-:backports.ssl_match_hostname:revision:3.2a3:tool:scancode:3.2.2'
    )
    expect(queue.data.length).to.eq(0)
  })

  it('handles bogus message', async () => {
    const { queue, definitionService, logger } = setup({ junk: 'here' })
    await process(queue, definitionService, logger, true)

    expect(definitionService.computeStoreAndCurate.calledOnce).to.be.false
    expect(logger.info.calledOnce).to.be.false
    expect(queue.data.length).to.eq(1)
  })
})

function setup(data) {
  const queue = memoryQueue()
  queue.queue(JSON.stringify(data))
  const definitionService = {
    computeStoreAndCurate: sinon.stub().resolves({}),
    computeAndStore: sinon.stub().resolves({})
  }
  const logger = {
    info: sinon.stub(),
    error: sinon.stub()
  }

  return { queue, definitionService, logger }
}
