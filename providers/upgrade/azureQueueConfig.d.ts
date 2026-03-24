// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type AzureStorageQueue from '../queueing/azureStorageQueue'
import type { AzureStorageQueueOptions } from '../queueing/azureStorageQueue'

/**
 * Factory function that creates an AzureStorageQueue configured for definition upgrade processing.
 * Reads `DEFINITION_UPGRADE_QUEUE_CONNECTION_STRING` (or `HARVEST_AZBLOB_CONNECTION_STRING` as fallback),
 * `DEFINITION_UPGRADE_QUEUE_NAME`, and `DEFINITION_UPGRADE_DEQUEUE_BATCH_SIZE` from the environment
 * when no options are provided.
 *
 * @param options - Optional override for queue configuration. Defaults to environment-derived config
 * @returns A configured AzureStorageQueue instance
 */
declare function azure(options?: AzureStorageQueueOptions): AzureStorageQueue

export = azure
