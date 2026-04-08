// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import memory from '../queueing/memoryQueue.js'
import DefinitionQueueUpgrader from './defUpgradeQueue.js'

/**
 * @param {Partial<import('./defUpgradeQueue').DefinitionQueueUpgraderOptions>} [options]
 * @returns {import('./defUpgradeQueue')}
 */
function serviceFactory(options = {}) {
  const mergedOptions = { queue: memory, ...options }
  return new DefinitionQueueUpgrader(mergedOptions)
}

export default serviceFactory
