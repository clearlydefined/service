// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import memory from '../queueing/memoryQueue.ts'
import type { DefinitionQueueUpgraderOptions } from './defUpgradeQueue.ts'
import DefinitionQueueUpgrader from './defUpgradeQueue.ts'

function serviceFactory(options: Partial<DefinitionQueueUpgraderOptions> = {}): DefinitionQueueUpgrader {
  const mergedOptions = { queue: memory, ...options }
  return new DefinitionQueueUpgrader(mergedOptions)
}

export default serviceFactory
