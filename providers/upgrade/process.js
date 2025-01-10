// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { factory } = require('./defVersionCheck')
const Cache = require('../caching/memory')

class QueueHandler {
  constructor(queue, logger, messageHandler = { processMessage: async () => {} }) {
    this._queue = queue
    this.logger = logger
    this._messageHandler = messageHandler
  }

  async work(once) {
    let isQueueEmpty = true
    try {
      const messages = await this._queue.dequeueMultiple()
      if (messages && messages.length > 0) isQueueEmpty = false
      const results = await Promise.allSettled(
        messages.map(async message => {
          await this._messageHandler.processMessage(message)
          await this._queue.delete(message)
        })
      )
      results.filter(result => result.status === 'rejected').forEach(result => this.logger.error(result.reason))
    } catch (error) {
      this.logger.error(error)
    } finally {
      if (!once) setTimeout(this.work.bind(this), isQueueEmpty ? 10000 : 0)
    }
  }
}

class DefinitionUpgrader {
  static defaultTtlSeconds = 60 * 5 /* 5 mins */
  static delayInMSeconds = 500

  constructor(
    definitionService,
    logger,
    defVersionChecker,
    cache = Cache({ defaultTtlSeconds: DefinitionUpgrader.defaultTtlSeconds })
  ) {
    this.logger = logger
    this._definitionService = definitionService
    this._defVersionChecker = defVersionChecker
    this._defVersionChecker.currentSchema = definitionService.currentSchema
    this._upgradeLock = cache
  }

  async processMessage(message) {
    let coordinates = get(message, 'data.coordinates')
    if (!coordinates) return
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

  async _upgradeIfNecessary(coordinates) {
    try {
      const existing = await this._definitionService.getStored(coordinates)
      let result = await this._defVersionChecker.validate(existing)
      if (!result) {
        await this._definitionService.computeStoreAndCurate(coordinates)
        this.logger.info('Handled definition upgrade for %s', coordinates)
      } else {
        this.logger.debug('Skipped definition upgrade for %s', coordinates)
      }
    } catch (error) {
      const context = `Error handling definition upgrade for ${coordinates.toString()}`
      const newError = new Error(`${context}: ${error.message}`)
      newError.stack = error.stack
      throw newError
    }
  }
}

function setup(_queue, _definitionService, _logger, once = false, _defVersionChecker = factory({ logger: _logger })) {
  const defUpgrader = new DefinitionUpgrader(_definitionService, _logger, _defVersionChecker)
  const queueHandler = new QueueHandler(_queue, _logger, defUpgrader)
  return queueHandler.work(once)
}

module.exports = { DefinitionUpgrader, QueueHandler, setup }
