import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
// @ts-nocheck
// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import EntityCoordinates from '../../../lib/entityCoordinates.js'
import { DefinitionUpgrader, QueueHandler } from '../../../providers/upgrade/process.js'

describe('Definition Upgrade Queue Processing', () => {
  let logger

  beforeEach(() => {
    logger = {
      info: mock.fn(),
      error: mock.fn(),
      debug: mock.fn()
    }
  })

  describe('QueueHandler', () => {
    let queue
    let messageHandler
    let handler

    beforeEach(() => {
      queue = {
        dequeueMultiple: mock.fn(),
        delete: mock.fn(async () => {})
      }
      messageHandler = {
        processMessage: mock.fn()
      }
      handler = new QueueHandler(queue, logger, messageHandler)
    })

    it('returns an instance of QueueHandler', () => {
      assert.ok(handler instanceof QueueHandler)
    })

    it('works on a queue', () => {
      queue.dequeueMultiple.mock.mockImplementation(async () => [])

      handler.work(true)
      assert.strictEqual(queue.dequeueMultiple.mock.callCount() === 1, true)
      assert.strictEqual(messageHandler.processMessage.mock.callCount() === 0, true)
      assert.strictEqual(queue.delete.mock.callCount() === 0, true)
    })

    it('processes one message', async () => {
      queue.dequeueMultiple.mock.mockImplementation(async () => [{ message: 'test' }])

      await handler.work(true)
      assert.strictEqual(queue.dequeueMultiple.mock.callCount() === 1, true)
      assert.strictEqual(messageHandler.processMessage.mock.callCount() === 1, true)
      assert.strictEqual(queue.delete.mock.callCount() === 1, true)
    })

    it('processes multiple messages', async () => {
      queue.dequeueMultiple.mock.mockImplementation(async () => [{ message: 'testA' }, { message: 'testB' }])

      await handler.work(true)
      assert.strictEqual(queue.dequeueMultiple.mock.callCount() === 1, true)
      assert.strictEqual(messageHandler.processMessage.mock.callCount() === 2, true)
      assert.strictEqual(queue.delete.mock.callCount() === 2, true)
    })

    it('handles if error is thrown', async () => {
      queue.dequeueMultiple.mock.mockImplementation(async () => [{ message: 'testA' }])

      messageHandler.processMessage = mock.fn(() => {
        throw new Error()
      })
      await handler.work(true)
      assert.strictEqual(queue.dequeueMultiple.mock.callCount() === 1, true)
      assert.strictEqual(messageHandler.processMessage.mock.callCount() === 1, true)
      assert.strictEqual(queue.delete.mock.callCount() > 0, false)
      assert.strictEqual(logger.error.mock.callCount() === 1, true)
    })

    it('handles both sucessful and unsucessful messages', async () => {
      queue.dequeueMultiple.mock.mockImplementation(async () => [{ message: 'testA' }, { message: 'testB' }])

      messageHandler.processMessage = mock.fn(
        (() => {
          let n = 0
          return async () => {
            if (n++ === 0) throw new Error()
          }
        })()
      )
      await handler.work(true)
      assert.strictEqual(queue.dequeueMultiple.mock.callCount() === 1, true)
      assert.strictEqual(messageHandler.processMessage.mock.callCount() === 2, true)
      assert.strictEqual(queue.delete.mock.callCount() === 1, true)
      assert.strictEqual(logger.error.mock.callCount() === 1, true)
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
        getStored: mock.fn(),
        computeStoreAndCurate: mock.fn(async () => {})
      }
      versionChecker = {
        validate: mock.fn()
      }
      upgrader = new DefinitionUpgrader(definitionService, logger, versionChecker)
    })

    it('recomputes a definition, if a definition is not up-to-date', async () => {
      definitionService.getStored.mock.mockImplementation(async () => definition)

      versionChecker.validate.mock.mockImplementation(async () => {})

      await upgrader.processMessage(message)
      assert.strictEqual(definitionService.getStored.mock.callCount() === 1, true)
      assert.strictEqual(versionChecker.validate.mock.callCount() === 1, true)
      assert.strictEqual(definitionService.computeStoreAndCurate.mock.callCount() === 1, true)
    })

    it('skips compute if a definition is up-to-date', async () => {
      definitionService.getStored.mock.mockImplementation(async () => definition)

      versionChecker.validate.mock.mockImplementation(async () => definition)

      await upgrader.processMessage(message)
      assert.strictEqual(definitionService.getStored.mock.callCount() === 1, true)
      assert.strictEqual(versionChecker.validate.mock.callCount() === 1, true)
      assert.strictEqual(definitionService.computeStoreAndCurate.mock.callCount() === 0, true)
    })

    it('computes if a definition does not exist', async () => {
      definitionService.getStored.mock.mockImplementation(async () => {})

      versionChecker.validate.mock.mockImplementation(async () => {})

      await upgrader.processMessage(message)
      assert.strictEqual(definitionService.getStored.mock.callCount() === 1, true)
      assert.strictEqual(versionChecker.validate.mock.callCount() === 1, true)
      assert.strictEqual(definitionService.computeStoreAndCurate.mock.callCount() === 1, true)
    })

    it('skips if there is no coordinates', async () => {
      await upgrader.processMessage({ data: {} })
      assert.strictEqual(definitionService.getStored.mock.callCount() === 0, true)
      assert.strictEqual(versionChecker.validate.mock.callCount() === 0, true)
      assert.strictEqual(definitionService.computeStoreAndCurate.mock.callCount() === 0, true)
    })

    it('handles exception by rethrowing with coordinates and the original error message', async () => {
      definitionService.getStored.mock.mockImplementation(async () => definition)

      versionChecker.validate.mock.mockImplementation(async () => {})

      definitionService.computeStoreAndCurate.mock.mockImplementation(async () => {
        throw new Error('test')
      })

      await assert.rejects(upgrader.processMessage(message), Error, /pypi\/pypi\/-\/test\/revision: test/)
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
    let versionChecker
    beforeEach(() => {
      let definitionUpgrader
      ;({ definitionService, versionChecker, definitionUpgrader } = setupDefinitionUpgrader(logger))
      queue = {
        dequeueMultiple: mock.fn(async () => [message]),
        delete: mock.fn(async () => {})
      }
      handler = new QueueHandler(queue, logger, definitionUpgrader)
    })

    it('handles exception and logs the coordinates and the original error message', async () => {
      definitionService.getStored.mock.mockImplementation(async () => definition)

      versionChecker.validate.mock.mockImplementation(async () => {})

      definitionService.computeStoreAndCurate.mock.mockImplementation(async () => {
        throw new Error('test')
      })

      await handler.work(true)
      assert.strictEqual(queue.dequeueMultiple.mock.callCount() === 1, true)
      assert.strictEqual(queue.delete.mock.callCount() > 0, false)
      assert.strictEqual(logger.error.mock.callCount() === 1, true)
      assert.match(logger.error.mock.calls[0].arguments[0].message, /pypi\/pypi\/-\/test\/revision: test/)
    })

    it('skips compute if a definition is up-to-date', async () => {
      definitionService.getStored.mock.mockImplementation(async () => definition)

      versionChecker.validate.mock.mockImplementation(async () => definition)

      await handler.work(true)
      assert.strictEqual(definitionService.getStored.mock.callCount() === 1, true)
      assert.strictEqual(versionChecker.validate.mock.callCount() === 1, true)
      assert.strictEqual(definitionService.computeStoreAndCurate.mock.callCount() === 0, true)
      assert.strictEqual(queue.delete.mock.callCount() > 0, true)
    })

    it('recomputes a definition, if a definition is not up-to-date', async () => {
      definitionService.getStored.mock.mockImplementation(async () => definition)

      versionChecker.validate.mock.mockImplementation(async () => {})

      await handler.work(true)
      assert.strictEqual(definitionService.getStored.mock.callCount() === 1, true)
      assert.strictEqual(versionChecker.validate.mock.callCount() === 1, true)
      assert.strictEqual(definitionService.computeStoreAndCurate.mock.callCount() === 1, true)
      assert.strictEqual(queue.delete.mock.callCount() > 0, true)
    })
  })
})

function setupDefinitionUpgrader(logger) {
  const definitionService = {
    getStored: mock.fn(),
    computeStoreAndCurate: mock.fn(async () => {})
  }
  const versionChecker = {
    validate: mock.fn()
  }
  const definitionUpgrader = new DefinitionUpgrader(definitionService, logger, versionChecker)
  return { definitionService, versionChecker, definitionUpgrader }
}
