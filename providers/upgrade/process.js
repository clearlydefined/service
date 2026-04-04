// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { factory } = require('./defVersionCheck')

/**
 * @typedef {import('../queueing').IQueue} IQueue
 * @typedef {import('../queueing').DequeuedMessage} DequeuedMessage
 * @typedef {import('../../business/definitionService').DefinitionService} DefinitionService
 * @typedef {import('../../business/definitionService').UpgradeHandler} UpgradeHandler
 * @typedef {import('../logging').Logger} Logger
 */

class QueueHandler {
  /**
   * @param {IQueue} queue
   * @param {Logger} logger
   * @param {import('./process').MessageHandler} [messageHandler]
   */
  constructor(queue, logger, messageHandler = { processMessage: async () => {} }) {
    this._queue = queue
    this.logger = logger
    this._messageHandler = messageHandler
  }

  /** @param {boolean} [once] */
  async work(once) {
    let isQueueEmpty = true
    try {
      const messages = await this._queue.dequeueMultiple()
      if (messages && messages.length > 0) {
        isQueueEmpty = false
      }
      const results = await Promise.allSettled(
        messages.map(async message => {
          try {
            await this._messageHandler.processMessage(message)
          } finally {
            // Always delete: mirrors on-demand single-attempt semantics.
            // On error, the next HTTP request will re-enqueue if needed.
            await this._queue.delete(message)
          }
        })
      )
      for (const result of results.filter(result => result.status === 'rejected')) {
        this.logger.error(result.reason)
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error))
    } finally {
      if (!once) {
        setTimeout(this.work.bind(this), isQueueEmpty ? 10000 : 0)
      }
    }
  }
}

class DefinitionUpgrader {
  /**
   * @param {DefinitionService} definitionService
   * @param {Logger} logger
   * @param {UpgradeHandler} upgradePolicy
   */
  constructor(definitionService, logger, upgradePolicy) {
    this.logger = logger
    this._definitionService = definitionService
    this._upgradePolicy = upgradePolicy
    this._upgradePolicy.currentSchema = definitionService.currentSchema
  }

  /** @param {DequeuedMessage} message */
  async processMessage(message) {
    let coordinates = get(message, 'data.coordinates')
    if (!coordinates) {
      return
    }
    coordinates = EntityCoordinates.fromObject(coordinates)

    try {
      const result = await this._definitionService.computeStoreAndCurateIf(coordinates, async () => {
        const existing = await this._definitionService.getStored(coordinates)
        const valid = await this._upgradePolicy.validate(existing)
        const needsCompute = !valid
        return needsCompute
      })
      if (result) {
        this.logger.info('Handled definition upgrade', { coordinates })
      } else {
        this.logger.debug('Skipped definition upgrade', { coordinates })
      }
    } catch (error) {
      const originalError = error instanceof Error ? error : new Error(String(error))
      throw new Error(`${coordinates}: ${originalError.message}`, { cause: originalError })
    }
  }
}

/**
 * @param {IQueue} _queue
 * @param {DefinitionService} _definitionService
 * @param {Logger} _logger
 * @param {boolean} [once]
 * @param {UpgradeHandler} [_upgradePolicy]
 */
function setup(_queue, _definitionService, _logger, once = false, _upgradePolicy = factory({ logger: _logger })) {
  const defUpgrader = new DefinitionUpgrader(_definitionService, _logger, _upgradePolicy)
  const queueHandler = new QueueHandler(_queue, _logger, defUpgrader)
  return queueHandler.work(once)
}

module.exports = { DefinitionUpgrader, QueueHandler, setup }
