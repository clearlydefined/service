// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'

const { get } = lodash

import type { DefinitionService, UpgradeHandler } from '../../business/definitionService.ts'
import EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'
import type { DequeuedMessage, IQueue } from '../queueing/index.js'
import { factory } from './defVersionCheck.ts'

/** Handler that processes individual dequeued messages */
export interface MessageHandler {
  processMessage(message: DequeuedMessage): Promise<void>
}

class QueueHandler {
  logger: Logger
  declare _queue: IQueue
  declare _messageHandler: MessageHandler

  constructor(queue: IQueue, logger: Logger, messageHandler: MessageHandler = { processMessage: async () => {} }) {
    this._queue = queue
    this.logger = logger
    this._messageHandler = messageHandler
  }

  async work(once?: boolean): Promise<void> {
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

class DefinitionRecomputer implements MessageHandler {
  logger: Logger
  declare _definitionService: DefinitionService
  declare _upgradePolicy: UpgradeHandler

  constructor(definitionService: DefinitionService, logger: Logger, upgradePolicy: UpgradeHandler) {
    this.logger = logger
    this._definitionService = definitionService
    this._upgradePolicy = upgradePolicy
    this._upgradePolicy.currentSchema = definitionService.currentSchema
  }

  async processMessage(message: DequeuedMessage): Promise<void> {
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
        this.logger.info('Handled definition recompute', { coordinates: coordinates.toString() })
      } else {
        this.logger.debug('Skipped definition recompute', { coordinates: coordinates.toString() })
      }
    } catch (error) {
      const context = `Error handling definition recompute for ${coordinates.toString()}`
      const originalError = error instanceof Error ? error : new Error(String(error))
      throw new Error(context, { cause: originalError })
    }
  }
}

function setup(
  _queue: IQueue,
  _definitionService: DefinitionService,
  _logger: Logger,
  once: boolean = false,
  _upgradePolicy: UpgradeHandler = factory({ logger: _logger })
): Promise<void> {
  const defRecomputer = new DefinitionRecomputer(_definitionService, _logger, _upgradePolicy)
  const queueHandler = new QueueHandler(_queue, _logger, defRecomputer)
  return queueHandler.work(once)
}

export { DefinitionRecomputer, QueueHandler, setup }
