// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { factory } = require('./defVersionCheck')
const Cache = require('../caching/memory')

/**
 * @typedef {import('../queueing').IQueue} IQueue
 * @typedef {import('../queueing').DequeuedMessage} DequeuedMessage
 * @typedef {import('../../business/definitionService').DefinitionService} DefinitionService
 * @typedef {import('../../business/definitionService').UpgradeHandler} UpgradeHandler
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('../caching').ICache} ICache
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
          await this._messageHandler.processMessage(message)
          await this._queue.delete(message)
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
  static defaultTtlSeconds = 60 * 5 /* 5 mins */
  static delayInMSeconds = 500

  /**
   * @param {DefinitionService} definitionService
   * @param {Logger} logger
   * @param {UpgradeHandler} upgradePolicy
   * @param {ICache} [cache]
   */
  constructor(
    definitionService,
    logger,
    upgradePolicy,
    cache = Cache({ defaultTtlSeconds: DefinitionUpgrader.defaultTtlSeconds })
  ) {
    this.logger = logger
    this._definitionService = definitionService
    this._upgradePolicy = upgradePolicy
    this._upgradePolicy.currentSchema = definitionService.currentSchema
    this._upgradeLock = cache
  }

  /** @param {DequeuedMessage} message */
  async processMessage(message) {
    let coordinates = get(message, 'data.coordinates')
    if (!coordinates) {
      return
    }
    coordinates = EntityCoordinates.fromObject(coordinates)

    while (this._upgradeLock.get(coordinates.toString())) {
      await new Promise(resolve => setTimeout(resolve, DefinitionUpgrader.delayInMSeconds))
    }
    try {
      this._upgradeLock.set(coordinates.toString(), true)
      await this._upgradeIfNecessary(coordinates)
    } finally {
      this._upgradeLock.delete(coordinates.toString())
    }
  }

  /** @param {import('../../lib/entityCoordinates')} coordinates */
  async _upgradeIfNecessary(coordinates) {
    try {
      const existing = await this._definitionService.getStored(coordinates)
      let result = await this._upgradePolicy.validate(existing)
      if (!result) {
        await this._definitionService.computeStoreAndCurate(coordinates)
        this.logger.info('Handled definition upgrade', { coordinates })
      } else {
        this.logger.debug('Skipped definition upgrade', { coordinates })
      }
    } catch (error) {
      const context = `Error handling definition upgrade for ${coordinates.toString()}`
      const originalError = error instanceof Error ? error : new Error(String(error))
      const newError = new Error(`${context}: ${originalError.message}`)
      newError.stack = originalError.stack
      throw newError
    }
  }
}

/**
 * @param {IQueue} _queue
 * @param {DefinitionService} _definitionService
 * @param {Logger} _logger
 * @param {boolean} [once]
 * @param {UpgradeHandler} [_upgradePolicy]
 * @param {ICache} [sharedCache]
 */
function setup(
  _queue,
  _definitionService,
  _logger,
  once = false,
  _upgradePolicy = factory({ logger: _logger }),
  sharedCache
) {
  const defUpgrader = new DefinitionUpgrader(_definitionService, _logger, _upgradePolicy, sharedCache)
  const queueHandler = new QueueHandler(_queue, _logger, defUpgrader)
  return queueHandler.work(once)
}

module.exports = { DefinitionUpgrader, QueueHandler, setup }
