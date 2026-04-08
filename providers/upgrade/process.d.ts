// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { DefinitionService, UpgradeHandler } from '../../business/definitionService.js'
import type { Logger } from '../logging/index.js'
import type { DequeuedMessage, IQueue } from '../queueing/index.js'

/** Handler that processes individual dequeued messages */
export interface MessageHandler {
  processMessage(message: DequeuedMessage): Promise<void>
}

/**
 * Generic queue processor that continuously dequeues messages and delegates
 * to a message handler. Uses Promise.allSettled to process batches, logging
 * failures without stopping the loop.
 */
export declare class QueueHandler {
  logger: Logger

  /**
   * @param queue - The queue to dequeue messages from
   * @param logger - Logger instance
   * @param messageHandler - Handler that processes individual messages
   */
  constructor(queue: IQueue, logger: Logger, messageHandler?: MessageHandler)

  /**
   * Starts processing the queue.
   *
   * @param once - If true, processes one batch and stops. If false (default), loops with a 10s delay on empty queues
   */
  work(once?: boolean): Promise<void>
}

/**
 * Processes upgrade messages by recomputing stale definitions.
 * Serialization is handled by computeLock in definitionService via computeStoreAndCurateIf.
 */
export declare class DefinitionUpgrader implements MessageHandler {
  logger: Logger

  /**
   * @param definitionService - Service for fetching and recomputing definitions
   * @param logger - Logger instance
   * @param upgradePolicy - Policy that validates whether stored definitions need upgrade
   */
  constructor(definitionService: DefinitionService, logger: Logger, upgradePolicy: UpgradeHandler)

  /**
   * Processes a single dequeued upgrade message.
   *
   * @param message - The dequeued message containing definition coordinates
   */
  processMessage(message: DequeuedMessage): Promise<void>
}

/**
 * Sets up and starts the definition upgrade queue processor.
 *
 * @param queue - The queue to dequeue upgrade messages from
 * @param definitionService - Service for computing and storing definitions
 * @param logger - Logger instance
 * @param once - If true, processes one batch and stops
 * @param upgradePolicy - Upgrade policy (defaults to a new DefinitionVersionChecker)
 */
export declare function setup(
  queue: IQueue,
  definitionService: DefinitionService,
  logger: Logger,
  once?: boolean,
  upgradePolicy?: UpgradeHandler
): Promise<void>
