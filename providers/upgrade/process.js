// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { factory } = require('./defVersionCheck')

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
  constructor(definitionService, logger, defVersionChecker) {
    this.logger = logger
    this._definitionService = definitionService
    this._defVersionChecker = defVersionChecker
    this._defVersionChecker.currentSchema = definitionService.currentSchema
  }

  async processMessage(message) {
    let coordinates = get(message, 'data.coordinates')
    if (!coordinates) return

    coordinates = EntityCoordinates.fromObject(coordinates)
    const existing = await this._definitionService.getStored(coordinates)
    let result = await this._defVersionChecker.validate(existing)
    if (!result) {
      await this._definitionService.computeStoreAndCurate(coordinates)
      this.logger.info(`Handled definition update for ${coordinates.toString()}`)
    } else {
      this.logger.debug(`Skipped definition update for ${coordinates.toString()}`)
    }
  }
}

let queueHandler
let defUpgrader

function setup(_queue, _definitionService, _logger, once = false, _defVersionChecker = factory()) {
  defUpgrader = new DefinitionUpgrader(_definitionService, _logger, _defVersionChecker)
  queueHandler = new QueueHandler(_queue, _logger, defUpgrader)
  return queueHandler.work(once)
}

module.exports = { DefinitionUpgrader, QueueHandler, setup }
