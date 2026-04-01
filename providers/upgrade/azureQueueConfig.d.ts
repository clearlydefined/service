// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RecomputeQueueFactories } from '..'
import type AzureStorageQueue from '../queueing/azureStorageQueue'

/**
 * Queue factories for upgrade and delayed compute processing.
 *
 * `upgrade` reads DEFINITION_UPGRADE_* settings.
 * `compute` reads DEFINITION_COMPUTE_* settings and falls back to DEFINITION_UPGRADE_* where applicable.
 */
declare const queues: RecomputeQueueFactories<AzureStorageQueue>

export = queues
