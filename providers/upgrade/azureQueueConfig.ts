// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { RecomputeQueueFactories } from '../index.ts'
import type { AzureStorageQueueOptions } from '../queueing/azureStorageQueue.ts'
import AzureStorageQueue from '../queueing/azureStorageQueue.ts'

const upgradeDefaultOptions: AzureStorageQueueOptions = {
  connectionString:
    (config.get('DEFINITION_UPGRADE_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'))!,
  queueName: config.get('DEFINITION_UPGRADE_QUEUE_NAME') || 'definitions-upgrade',
  dequeueOptions: {
    numOfMessages: config.get('DEFINITION_UPGRADE_DEQUEUE_BATCH_SIZE') || 16,
    visibilityTimeout: 20 * 60 // 20 min; covers p95 total processing time (~16 min over 20 days, dominated by computeLock wait)
  }
}

const computeDefaultOptions: AzureStorageQueueOptions = {
  connectionString:
    (config.get('DEFINITION_COMPUTE_QUEUE_CONNECTION_STRING') ||
    config.get('DEFINITION_UPGRADE_QUEUE_CONNECTION_STRING') ||
    config.get('HARVEST_AZBLOB_CONNECTION_STRING'))!,
  queueName: config.get('DEFINITION_COMPUTE_QUEUE_NAME') || 'recompute',
  dequeueOptions: {
    numOfMessages: 32, // Azure Storage Queue maximum; compute queue is high-traffic (~10K/hr)
    visibilityTimeout: 20 * 60 // 20 min; covers p95 total processing time (~16 min over 20 days, dominated by computeLock wait)
  }
}

function azure(options?: AzureStorageQueueOptions): AzureStorageQueue {
  return new AzureStorageQueue(options || upgradeDefaultOptions)
}

function computeQueueFactory(options?: AzureStorageQueueOptions): AzureStorageQueue {
  return new AzureStorageQueue(options || computeDefaultOptions)
}

const queues: RecomputeQueueFactories<AzureStorageQueue> = { upgrade: azure, compute: computeQueueFactory }
export default queues
