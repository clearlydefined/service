// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type DefinitionQueueUpgrader from './defUpgradeQueue.js'
import type { DefinitionQueueUpgraderOptions } from './defUpgradeQueue.js'

/**
 * Factory function that creates a DefinitionQueueUpgrader with a default memory queue.
 * Callers may override the queue factory or pass additional options.
 *
 * @param options - Optional configuration. Defaults to using a memory queue.
 * @returns A new DefinitionQueueUpgrader instance
 */
declare function serviceFactory(options?: Partial<DefinitionQueueUpgraderOptions>): DefinitionQueueUpgrader

export default serviceFactory
