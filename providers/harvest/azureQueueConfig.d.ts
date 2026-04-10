// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type AzureStorageQueue from '../queueing/azureStorageQueue.ts'
import type { AzureStorageQueueOptions } from '../queueing/azureStorageQueue.ts'

/**
 * Factory function that creates an AzureStorageQueue configured for harvest processing.
 * Reads `HARVEST_QUEUE_CONNECTION_STRING`, `HARVEST_AZBLOB_CONNECTION_STRING`,
 * and `HARVEST_QUEUE_NAME` from the environment when no options are provided.
 *
 * @param options - Optional override for queue configuration. Defaults to environment-derived config
 * @returns A configured AzureStorageQueue instance
 */
declare function azure(options?: AzureStorageQueueOptions): AzureStorageQueue

export default azure
