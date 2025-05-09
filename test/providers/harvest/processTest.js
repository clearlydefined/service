// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const process = require('../../../providers/harvest/process')
const memoryQueue = require('../../../providers/queueing/memoryQueue')
const sinon = require('sinon')

describe('Harvest queue processing', () => {
  it('handles new message from clearlydefined tool', async () => {
    const { queue, definitionService, logger } = await setup(
      'urn:gem:rubygems:-:0mq:revision:0.5.2:tool:clearlydefined:1.3.3'
    )
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
    const { queue, definitionService, logger } = await setup(
      'urn:pypi:pypi:-:backports.ssl_match_hostname:revision:3.2a3:tool:scancode:3.2.2'
    )
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

  it('handles processed message from non-clearlydefined tool', async () => {
    const { queue, definitionService, logger } = await setup(
      'urn:pypi:pypi:-:backports.ssl_match_hostname:revision:3.2a3:tool:scancode:3.2.2'
    )
    definitionService.getStored.resolves({
      described: {
        tools: ['scancode/3.2.2']
      }
    })
    await process(queue, definitionService, logger, true)

    expect(definitionService.computeAndStore.called).to.be.false
    expect(logger.info.calledTwice).to.be.true
    expect(logger.info.getCall(0).args[0]).to.eq(
      'Skip definition computation as the tool result has already been processed'
    )
    expect(logger.info.getCall(1).args[0]).to.eq(
      'Handled Crawler update event for urn:pypi:pypi:-:backports.ssl_match_hostname:revision:3.2a3:tool:scancode:3.2.2'
    )
    expect(queue.data.length).to.eq(0)
  })

  it('handles two messages for the same coordinates: computes the first and skip the second', async () => {
    const { queue, definitionService, logger, lock } = await setup(
      'urn:pypi:pypi:-:dnspython:revision:2.6.0:tool:clearlydefined:1.4.1',
      'urn:pypi:pypi:-:dnspython:revision:2.6.0:tool:licensee:9.18.1'
    )
    definitionService.getStored.resolves({
      described: {
        tools: ['clearlydefined/1.4.1', 'licensee/9.18.1']
      }
    })

    await process(queue, definitionService, logger, true, lock)

    const coordinates = {
      type: 'pypi',
      provider: 'pypi',
      name: 'dnspython',
      revision: '2.6.0'
    }
    const coordinatesString = 'pypi/pypi/-/dnspython/2.6.0'

    expect(lock.set.calledTwice).to.be.true
    expect(lock.set.getCall(0).args[0]).to.eq(coordinatesString)
    expect(lock.set.getCall(1).args[0]).to.eq(coordinatesString)

    expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
    expect(definitionService.computeStoreAndCurate.getCall(0).args[0]).to.deep.eq(coordinates)

    expect(definitionService.getStored.calledOnce).to.be.true
    expect(definitionService.getStored.getCall(0).args[0]).to.deep.eq(coordinates)

    expect(lock.delete.calledTwice).to.be.true
    expect(lock.delete.getCall(0).args[0]).to.eq(coordinatesString)
    expect(lock.delete.getCall(1).args[0]).to.eq(coordinatesString)
    //lock is released before the second message is processed
    expect(lock.delete.firstCall.calledBefore(definitionService.getStored.firstCall)).to.be.true
    expect(definitionService.computeAndStore.called).to.be.false
  })

  it('handles three messages for the same coordinates: computes the first, skip the second and computes the third', async () => {
    const { queue, definitionService, logger, lock } = await setup(
      'urn:pypi:pypi:-:dnspython:revision:2.6.0:tool:clearlydefined:1.4.1',
      'urn:pypi:pypi:-:dnspython:revision:2.6.0:tool:licensee:9.18.1',
      'urn:pypi:pypi:-:dnspython:revision:2.6.0:tool:reuse:3.2.1'
    )
    definitionService.getStored.resolves({
      described: {
        tools: ['clearlydefined/1.4.1', 'licensee/9.18.1']
      }
    })
    await process(queue, definitionService, logger, true, lock)

    const coordinates = {
      type: 'pypi',
      provider: 'pypi',
      name: 'dnspython',
      revision: '2.6.0'
    }
    const coordinatesString = 'pypi/pypi/-/dnspython/2.6.0'
    expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
    expect(definitionService.computeStoreAndCurate.getCall(0).args[0]).to.deep.eq(coordinates)

    expect(definitionService.getStored.calledTwice).to.be.true
    expect(definitionService.getStored.getCall(0).args[0]).to.deep.eq(coordinates)
    expect(definitionService.getStored.getCall(1).args[0]).to.deep.eq(coordinates)

    expect(definitionService.computeAndStore.calledOnce).to.be.true
    expect(definitionService.computeAndStore.getCall(0).args[0]).to.deep.eq(coordinates)

    expect(lock.delete.callCount).to.eq(3)
    expect(lock.delete.getCall(0).args[0]).to.eq(coordinatesString)
    expect(lock.delete.getCall(1).args[0]).to.eq(coordinatesString)
    expect(lock.delete.getCall(2).args[0]).to.eq(coordinatesString)

    //lock is released after processing and before the subsequent message is processed
    expect(definitionService.computeStoreAndCurate.firstCall.calledBefore(lock.delete.firstCall)).to.be.true
    expect(definitionService.getStored.firstCall.calledAfter(lock.delete.firstCall)).to.be.true

    expect(definitionService.getStored.firstCall.calledBefore(lock.delete.secondCall)).to.be.true
    expect(definitionService.getStored.secondCall.calledAfter(lock.delete.secondCall)).to.be.true

    expect(definitionService.computeAndStore.firstCall.calledBefore(lock.delete.getCall(2))).to.be.true
  })

  it('handles bogus message', async () => {
    const { queue, definitionService, logger } = await setup({ junk: 'here' })
    await process(queue, definitionService, logger, true)

    expect(definitionService.computeStoreAndCurate.called).to.be.false
    expect(logger.info.called).to.be.false
    expect(queue.data.length).to.eq(1)
  })
})

async function setup(urn, ...additionalUrns) {
  const queue = memoryQueue()
  queue.queue(JSON.stringify(createMessage(urn)))
  if (additionalUrns.length > 0) {
    await mockDequeueMultiple(queue, urn, additionalUrns)
  }
  const definitionService = {
    getStored: sinon.stub().resolves(null),
    computeStoreAndCurate: sinon.stub().resolves({}),
    computeAndStore: sinon.stub().resolves({})
  }
  const logger = {
    info: sinon.stub(),
    error: sinon.stub()
  }

  const lock = mockLock()

  return { queue, definitionService, logger, lock }
}

function mockLock() {
  const data = {}
  const lock = {
    get: key => data[key],
    set: (key, value) => (data[key] = value),
    delete: key => delete data[key]
  }
  sinon.spy(lock, 'get')
  sinon.spy(lock, 'set')
  sinon.spy(lock, 'delete')
  return lock
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

// memoryQueue only dequeues one message at a time with dequeueMultiple,
// so we need to mock it to dequeue multiple messages
// with the same coordinates but different tool versions
async function mockDequeueMultiple(queue, replaceText, toolVersions) {
  const message1 = await queue.dequeue()
  const messages = toolVersions.map(toolVersion =>
    JSON.parse(JSON.stringify(message1).replaceAll(replaceText, toolVersion))
  )
  queue.dequeueMultiple = sinon.stub().resolves([message1, ...messages])
}
