// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const { QueueHandler, DefinitionUpgrader } = require('../../../providers/upgrade/process')

describe('Definition Upgrade Queue Processing', () => {
  let logger

  beforeEach(() => {
    logger = {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    }
  })

  describe('QueueHandler', () => {
    let queue, messageHandler, handler

    beforeEach(() => {
      queue = {
        dequeueMultiple: sinon.stub(),
        delete: sinon.stub().resolves()
      }
      messageHandler = {
        processMessage: sinon.stub()
      }
      handler = new QueueHandler(queue, logger, messageHandler)
    })

    it('returns an instance of QueueHandler', () => {
      expect(handler).to.be.an.instanceOf(QueueHandler)
    })

    it('works on a queue', () => {
      queue.dequeueMultiple.resolves([])
      handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.notCalled).to.be.true
      expect(queue.delete.notCalled).to.be.true
    })

    it('processes one message', async () => {
      queue.dequeueMultiple.resolves([{ message: 'test' }])
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledOnce).to.be.true
      expect(queue.delete.calledOnce).to.be.true
    })

    it('processes multiple messages', async () => {
      queue.dequeueMultiple.resolves([{ message: 'testA' }, { message: 'testB' }])
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledTwice).to.be.true
      expect(queue.delete.calledTwice).to.be.true
    })

    it('handles if error is thrown', async () => {
      queue.dequeueMultiple.resolves([{ message: 'testA' }])
      messageHandler.processMessage = sinon.stub().throws()
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledOnce).to.be.true
      expect(queue.delete.called).to.be.false
      expect(logger.error.calledOnce).to.be.true
    })

    it('handles both sucessful and unsucessful messages', async () => {
      queue.dequeueMultiple.resolves([{ message: 'testA' }, { message: 'testB' }])
      messageHandler.processMessage = sinon.stub().onFirstCall().throws().onSecondCall().resolves()
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledTwice).to.be.true
      expect(queue.delete.calledOnce).to.be.true
      expect(logger.error.calledOnce).to.be.true
    })
  })

  describe('DefinitionUpgrader', () => {
    const definition = Object.freeze({ coordinates: 'pypi/pypi/-/test/revision' })
    let definitionService, versionChecker, upgrader

    beforeEach(() => {
      definitionService = {
        getStored: sinon.stub(),
        computeStoreAndCurate: sinon.stub().resolves()
      }
      versionChecker = {
        validate: sinon.stub()
      }
      upgrader = new DefinitionUpgrader(definitionService, logger, versionChecker)
    })

    it('recomputes a definition, if a definition is not up-to-date', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves()

      await upgrader.processMessage({ data: { coordinates: 'pypi/pypi/-/test/revision' } })
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
    })

    it('skips compute if a definition is up-to-date', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves(definition)

      await upgrader.processMessage({ data: { coordinates: 'pypi/pypi/-/test/revision' } })
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.notCalled).to.be.true
    })

    it('computes if a definition does not exist', async () => {
      definitionService.getStored.resolves()
      versionChecker.validate.resolves()

      await upgrader.processMessage({ data: { coordinates: 'pypi/pypi/-/test/revision' } })
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
    })

    it('skips if there is no coordinates', async () => {
      await upgrader.processMessage({ data: {} })
      expect(definitionService.getStored.notCalled).to.be.true
      expect(versionChecker.validate.notCalled).to.be.true
      expect(definitionService.computeStoreAndCurate.notCalled).to.be.true
    })
  })
})
