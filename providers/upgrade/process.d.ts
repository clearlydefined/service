// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { IQueue, DequeuedMessage } from '../queueing'
import type { DefinitionService, UpgradeHandler } from '../../business/definitionService'
import type { Logger } from '../logging'
import type { ICache } from '../caching'

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
 * Uses an in-memory lock to prevent concurrent upgrades for the same coordinates.
 */
export declare class DefinitionUpgrader implements MessageHandler {
  /** Default cache TTL in seconds (5 minutes) */
  static readonly defaultTtlSeconds: number
  /** Delay in milliseconds between lock-retry attempts */
  static readonly delayInMSeconds: number

  logger: Logger

  /**
   * @param definitionService - Service for fetching and recomputing definitions
   * @param logger - Logger instance
   * @param upgradePolicy - Policy that validates whether stored definitions need upgrade
   * @param cache - Cache used as an upgrade lock (defaults to in-memory with 5 min TTL)
   */
  constructor(definitionService: DefinitionService, logger: Logger, upgradePolicy: UpgradeHandler, cache?: ICache)

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
