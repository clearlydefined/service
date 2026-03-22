// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition } from '../../business/definitionService'
import type { DefinitionService } from '../../business/definitionService'
import type { Logger } from '../logging'
import type { IQueue } from '../queueing'
import { DefinitionVersionChecker, type DefinitionVersionCheckerOptions } from './defVersionCheck'

/** Configuration options for DefinitionQueueUpgrader */
export interface DefinitionQueueUpgraderOptions extends DefinitionVersionCheckerOptions {
  /** Factory function that creates the upgrade queue */
  queue: () => IQueue
}

/**
 * Version checker that enqueues stale definitions for asynchronous upgrade
 * rather than blocking the request. Extends DefinitionVersionChecker to add
 * queue-based upgrade scheduling.
 */
declare class DefinitionQueueUpgrader extends DefinitionVersionChecker {
  options: DefinitionQueueUpgraderOptions

  constructor(options?: DefinitionQueueUpgraderOptions)

  /**
   * Validates a definition's schema version. If stale, enqueues it for upgrade
   * and returns the definition as-is (so the caller gets a response immediately).
   *
   * @param definition - The definition to validate
   * @returns The definition (whether current or stale-but-queued), or undefined for null input
   */
  validate(definition: Definition | null): Promise<Definition | undefined>

  /**
   * Creates the upgrade queue from the configured factory and initializes it.
   */
  initialize(): Promise<void>

  /**
   * Sets up the queue processor that dequeues and recomputes stale definitions.
   *
   * @param definitionService - The service used to recompute definitions
   * @param logger - Logger instance
   * @param once - If true, process one batch and stop (for testing)
   */
  setupProcessing(definitionService: DefinitionService, logger: Logger, once?: boolean): Promise<void>
}

export default DefinitionQueueUpgrader
export = DefinitionQueueUpgrader
