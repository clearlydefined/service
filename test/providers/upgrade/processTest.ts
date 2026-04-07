// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import { expect } from 'chai'
import sinon from 'sinon'
import EntityCoordinates from '../../../lib/entityCoordinates.js'
import { DefinitionUpgrader, QueueHandler } from '../../../providers/upgrade/process.js'

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
    let queue
    let messageHandler
    let handler

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

    it('deletes message even if processing throws', async () => {
      queue.dequeueMultiple.resolves([{ message: 'testA' }])
      messageHandler.processMessage = sinon.stub().throws()
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledOnce).to.be.true
      expect(queue.delete.calledOnce).to.be.true
      expect(logger.error.calledOnce).to.be.true
    })

    it('deletes all messages regardless of per-message success or failure', async () => {
      queue.dequeueMultiple.resolves([{ message: 'testA' }, { message: 'testB' }])
      messageHandler.processMessage = sinon.stub().onFirstCall().throws().onSecondCall().resolves()
      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(messageHandler.processMessage.calledTwice).to.be.true
      expect(queue.delete.calledTwice).to.be.true
      expect(logger.error.calledOnce).to.be.true
    })
  })

  describe('DefinitionUpgrader', () => {
    const coordinates = 'pypi/pypi/-/test/revision'
    const definition = Object.freeze({ coordinates: EntityCoordinates.fromString(coordinates) })
    const message = Object.freeze({ data: { coordinates: definition.coordinates } })
    let definitionService
    let versionChecker
    let upgrader

    beforeEach(() => {
      definitionService = {
        getStored: sinon.stub(),
        computeStoreAndCurateIf: sinon.stub()
      }
      versionChecker = {
        validate: sinon.stub()
      }
      upgrader = new DefinitionUpgrader(definitionService, logger, versionChecker)
    })

    it('delegates to computeStoreAndCurateIf and logs when definition was recomputed', async () => {
      definitionService.computeStoreAndCurateIf.resolves(definition)

      await upgrader.processMessage(message)
      expect(definitionService.computeStoreAndCurateIf.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurateIf.getCall(0).args[0]).to.deep.eq(
        EntityCoordinates.fromObject(definition.coordinates)
      )
      expect(logger.info.calledOnce).to.be.true
    })

    it('delegates to computeStoreAndCurateIf and logs debug when compute was skipped', async () => {
      definitionService.computeStoreAndCurateIf.resolves(undefined)

      await upgrader.processMessage(message)
      expect(definitionService.computeStoreAndCurateIf.calledOnce).to.be.true
      expect(logger.debug.calledOnce).to.be.true
      expect(logger.info.notCalled).to.be.true
    })

    it('skips if there is no coordinates', async () => {
      await upgrader.processMessage({ data: {} })
      expect(definitionService.computeStoreAndCurateIf.notCalled).to.be.true
    })

    it('predicate skips compute when policy validates the definition', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves(definition) // truthy = valid → predicate returns false → skip
      let predicateResult: boolean | undefined
      definitionService.computeStoreAndCurateIf.callsFake(async (_coords, shouldCompute) => {
        predicateResult = await shouldCompute()
        return predicateResult ? definition : undefined
      })

      await upgrader.processMessage(message)
      expect(predicateResult).to.be.false
      expect(definitionService.getStored.calledOnceWith(EntityCoordinates.fromObject(definition.coordinates))).to.be
        .true
      expect(versionChecker.validate.calledOnceWith(definition)).to.be.true
      expect(logger.debug.calledOnce).to.be.true
    })

    it('predicate proceeds with compute when policy returns falsy', async () => {
      definitionService.getStored.resolves(definition)
      versionChecker.validate.resolves(undefined) // falsy = stale → predicate returns true → compute
      let predicateResult: boolean | undefined
      definitionService.computeStoreAndCurateIf.callsFake(async (_coords, shouldCompute) => {
        predicateResult = await shouldCompute()
        return predicateResult ? definition : undefined
      })

      await upgrader.processMessage(message)
      expect(predicateResult).to.be.true
      expect(definitionService.getStored.calledOnceWith(EntityCoordinates.fromObject(definition.coordinates))).to.be
        .true
      expect(versionChecker.validate.calledOnceWith(definition)).to.be.true
      expect(logger.info.calledOnce).to.be.true
    })

    it('handles exception by rethrowing with coordinates and the original error message', async () => {
      definitionService.computeStoreAndCurateIf.rejects(new Error('test'))

      await expect(upgrader.processMessage(message)).to.be.rejectedWith(Error, /pypi\/pypi\/-\/test\/revision: test/)
    })
  })

  describe('Integration Test', () => {
    const definition = Object.freeze({
      coordinates: { type: 'pypi', provider: 'pypi', name: 'test', revision: 'revision' },
      _meta: { schemaVersion: '0.0.1' }
    })
    const message = Object.freeze({ data: { ...definition } })

    let queue
    let handler
    let definitionService
    beforeEach(() => {
      let definitionUpgrader
      ;({ definitionService, definitionUpgrader } = setupDefinitionUpgrader(logger))
      queue = {
        dequeueMultiple: sinon.stub().resolves([message]),
        delete: sinon.stub().resolves()
      }
      handler = new QueueHandler(queue, logger, definitionUpgrader)
    })

    it('handles exception and logs the error', async () => {
      definitionService.computeStoreAndCurateIf.rejects(new Error('test'))

      await handler.work(true)
      expect(queue.dequeueMultiple.calledOnce).to.be.true
      expect(queue.delete.calledOnce).to.be.true
      expect(logger.error.calledOnce).to.be.true
      expect(logger.error.args[0][0].message).to.match(/pypi\/pypi\/-\/test\/revision: test/)
    })

    it('skips compute if a definition is up-to-date', async () => {
      definitionService.computeStoreAndCurateIf.resolves(undefined)

      await handler.work(true)
      expect(definitionService.computeStoreAndCurateIf.calledOnce).to.be.true
      expect(queue.delete.called).to.be.true
    })

    it('recomputes a definition, if a definition is not up-to-date', async () => {
      definitionService.computeStoreAndCurateIf.resolves(definition)

      await handler.work(true)
      expect(definitionService.computeStoreAndCurateIf.calledOnce).to.be.true
      expect(queue.delete.called).to.be.true
    })
  })
})

function setupDefinitionUpgrader(logger) {
  const definitionService = {
    getStored: sinon.stub(),
    computeStoreAndCurateIf: sinon.stub()
  }
  const versionChecker = {
    validate: sinon.stub()
  }
  const definitionUpgrader = new DefinitionUpgrader(definitionService as any, logger, versionChecker)
  return { definitionService, versionChecker, definitionUpgrader }
}
