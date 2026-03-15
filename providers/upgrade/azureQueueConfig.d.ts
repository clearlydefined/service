// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type AzureStorageQueue from '../queueing/azureStorageQueue'
import type { AzureStorageQueueOptions } from '../queueing/azureStorageQueue'

interface RecomputeQueueFactories {
  /**
   * Factory function that creates an AzureStorageQueue configured for definition upgrade processing.
   * Reads `DEFINITION_UPGRADE_QUEUE_CONNECTION_STRING` (or `HARVEST_AZBLOB_CONNECTION_STRING` as fallback),
   * `DEFINITION_UPGRADE_QUEUE_NAME`, and `DEFINITION_UPGRADE_DEQUEUE_BATCH_SIZE` from the environment
   * when no options are provided.
   *
   * @param options - Optional override for queue configuration. Defaults to environment-derived config
   * @returns A configured AzureStorageQueue instance
   */
  upgrade(options?: AzureStorageQueueOptions): AzureStorageQueue

  /**
   * Factory function that creates an AzureStorageQueue configured for delayed compute processing.
   * Reads `DEFINITION_COMPUTE_QUEUE_*` settings and falls back to upgrade settings where applicable.
   */
  compute(options?: AzureStorageQueueOptions): AzureStorageQueue
}

/**
 * Queue factories for upgrade and delayed compute processing.
 *
 * `upgrade` reads DEFINITION_UPGRADE_* settings.
 * `compute` reads DEFINITION_COMPUTE_* settings and falls back to DEFINITION_UPGRADE_* where applicable.
 */
declare const queues: RecomputeQueueFactories

export = queues
