// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chaiAsPromised = require('chai-as-promised')
const chai = require('chai')
chai.use(chaiAsPromised)
const { expect } = require('chai')
const sinon = require('sinon')
const { QueueHandler, DefinitionUpgrader } = require('../../../providers/upgrade/process')
const EntityCoordinates = require('../../../lib/entityCoordinates')

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
    const coordinates = 'pypi/pypi/-/test/revision'
    const definition = Object.freeze({ coordinates: EntityCoordinates.fromString(coordinates) })
    const message = Object.freeze({ data: { coordinates: definition.coordinates } })
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

      await upgrader.processMessage(message)
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
    })

    it('skips compute if a definition is up-to-date', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves(definition)

      await upgrader.processMessage(message)
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.notCalled).to.be.true
    })

    it('computes if a definition does not exist', async () => {
      definitionService.getStored.resolves()
      versionChecker.validate.resolves()

      await upgrader.processMessage(message)
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

    it('handles exception by rethrowing with coordinates and the original error message', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves()
      definitionService.computeStoreAndCurate.rejects(new Error('test'))

      await expect(upgrader.processMessage(message)).to.be.rejectedWith(Error, /pypi\/pypi\/-\/test\/revision: test/)
    })
  })

  describe('Integration Test', () => {
    const definition = Object.freeze({
      coordinates: { type: 'pypi', provider: 'pypi', name: 'test', revision: 'revision' },
      _meta: { schemaVersion: '0.0.1' }
    })
    const message = Object.freeze({ data: { ...definition } })

    let queue, handler, definitionService, versionChecker
    beforeEach(() => {
      let definitionUpgrader
      ;({ definitionService, versionChecker, definitionUpgrader } = setupDefinitionUpgrader(logger))
      queue = {
        dequeueMultiple: sinon.stub().resolves([message]),
        delete: sinon.stub().resolves()
      }
      handler = new QueueHandler(queue, logger, definitionUpgrader)
    })

    it('handles exception and logs the coordinates and the original error message', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves()
      definitionService.computeStoreAndCurate.rejects(new Error('test'))

      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(queue.delete.called).to.be.false
      expect(logger.error.calledOnce).to.be.true
      expect(logger.error.args[0][0].message).to.match(/pypi\/pypi\/-\/test\/revision: test/)
    })

    it('skips compute if a definition is up-to-date', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves(definition)

      await handler.work(true)
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.notCalled).to.be.true
      expect(queue.delete.called).to.be.true
    })

    it('recomputes a definition, if a definition is not up-to-date', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves()
      await handler.work(true)
      expect(definitionService.getStored.calledOnce).to.be.true
      expect(versionChecker.validate.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
      expect(queue.delete.called).to.be.true
    })
  })
})

function setupDefinitionUpgrader(logger) {
  const definitionService = {
    getStored: sinon.stub(),
    computeStoreAndCurate: sinon.stub().resolves()
  }
  const versionChecker = {
    validate: sinon.stub()
  }
  const definitionUpgrader = new DefinitionUpgrader(definitionService, logger, versionChecker)
  return { definitionService, versionChecker, definitionUpgrader }
}
