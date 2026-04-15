// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { AzureStorageQueueOptions } from '../queueing/azureStorageQueue.ts'
import AzureStorageQueue from '../queueing/azureStorageQueue.ts'

function azure(options?: AzureStorageQueueOptions): AzureStorageQueue {
  const realOptions: AzureStorageQueueOptions = options || {
    connectionString: (config.get('CURATION_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'))!,
    queueName: config.get('CURATION_QUEUE_NAME') || 'curations'
  }
  return new AzureStorageQueue(realOptions)
}

export default azure
