// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { DefinitionService } from '../../business/definitionService.js'
import type { Logger } from '../logging/index.js'
import type { IQueue } from '../queueing/index.js'

/**
 * Sets up and starts the harvest queue processor. Continuously dequeues messages and processes
 * them by computing and storing definitions via the definition service.
 *
 * @param queue - The queue to dequeue harvest messages from
 * @param definitionService - Service for computing and storing definitions
 * @param logger - Logger instance for error and info messages
 * @param once - If true, processes one batch and stops. If false (default), loops continuously
 * @returns Promise that resolves when initial processing is complete
 */
declare function setup(
  queue: IQueue,
  definitionService: DefinitionService,
  logger: Logger,
  once?: boolean
): Promise<void>

export default setup
