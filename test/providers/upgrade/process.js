// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const { QueueHandler, DefinitionUpgrader } = require('../../../providers/upgrade/process')

describe('Definition Upgrade Queue Processing', () => {
  describe('QueueHandler', () => {
    let logger, queue, messageHandler, handler
    beforeEach(() => {
      logger = {
        info: sinon.stub(),
        error: sinon.stub()
      }
      queue = {
        dequeueMultiple: sinon.stub(),
        delete: sinon.stub().resolves()
      }
      messageHandler = {
        processMessage: sinon.stub()
      }
      handler = new QueueHandler(queue, logger, messageHandler)
    })

    it('should return an instance of QueueHandler', () => {
      expect(handler).to.be.an.instanceOf(QueueHandler)
    })

    it('should work on a queue', () => {
      queue.dequeueMultiple.resolves([])
      handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.notCalled).to.be.true
      expect(queue.delete.notCalled).to.be.true
    })

    it('should process one message', async () => {
      queue.dequeueMultiple.resolves([{ message: 'test' }])
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledOnce).to.be.true
      expect(queue.delete.calledOnce).to.be.true
    })

    it('should process multiple messages', async () => {
      queue.dequeueMultiple.resolves([{ message: 'testA' }, { message: 'testB' }])
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledTwice).to.be.true
      expect(queue.delete.calledTwice).to.be.true
    })

    it('should log error and not delete the message', async () => {
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
    const definition = { coordinates: 'pypi/pypi/-/test/revision' }
    let logger, definitionService, versionChecker, upgrader
    beforeEach(() => {
      logger = {
        info: sinon.stub(),
        debug: sinon.stub()
      }
      definitionService = {
        getStored: sinon.stub(),
        computeStoreAndCurate: sinon.stub().resolves()
      }
      versionChecker = {
        validate: sinon.stub()
      }
      upgrader = new DefinitionUpgrader(definitionService, logger, versionChecker)
    })

    it('should recompute a definition', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves()

      await upgrader.processMessage({ data: { coordinates: 'pypi/pypi/-/test/revision' } })
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
    })

    it('should skip compute when a definition is up-to-date', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves(definition)

      await upgrader.processMessage({ data: { coordinates: 'pypi/pypi/-/test/revision' } })
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.notCalled).to.be.true
    })
  })
})
