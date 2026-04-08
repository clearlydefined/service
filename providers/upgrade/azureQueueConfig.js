// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import AzureStorageQueue from '../queueing/azureStorageQueue.js'

/** @typedef {import('../queueing/azureStorageQueue').AzureStorageQueueOptions} AzureStorageQueueOptions */

const upgradeDefaultOptions = {
  connectionString:
    config.get('DEFINITION_UPGRADE_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
  queueName: config.get('DEFINITION_UPGRADE_QUEUE_NAME') || 'definitions-upgrade',
  dequeueOptions: {
    numOfMessages: config.get('DEFINITION_UPGRADE_DEQUEUE_BATCH_SIZE') || 16,
    visibilityTimeout: 20 * 60 // 20 min; covers p95 total processing time (~16 min over 20 days, dominated by computeLock wait)
  }
}

const computeDefaultOptions = {
  connectionString:
    config.get('DEFINITION_COMPUTE_QUEUE_CONNECTION_STRING') ||
    config.get('DEFINITION_UPGRADE_QUEUE_CONNECTION_STRING') ||
    config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
  queueName: config.get('DEFINITION_COMPUTE_QUEUE_NAME') || 'recompute',
  dequeueOptions: {
    numOfMessages: 32, // Azure Storage Queue maximum; compute queue is high-traffic (~10K/hr)
    visibilityTimeout: 20 * 60 // 20 min; covers p95 total processing time (~16 min over 20 days, dominated by computeLock wait)
  }
}

/**
 * @param {AzureStorageQueueOptions} [options]
 * @returns {import('../queueing/azureStorageQueue')}
 */
function azure(options) {
  return new AzureStorageQueue(options || upgradeDefaultOptions)
}

/**
 * @param {AzureStorageQueueOptions} [options]
 * @returns {import('../queueing/azureStorageQueue')}
 */
function computeQueueFactory(options) {
  return new AzureStorageQueue(options || computeDefaultOptions)
}

export default { upgrade: azure, compute: computeQueueFactory }
