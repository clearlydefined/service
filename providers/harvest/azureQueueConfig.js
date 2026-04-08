// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import AzureStorageQueue from '../queueing/azureStorageQueue.js'

/**
 * @typedef {import('../queueing/azureStorageQueue').AzureStorageQueueOptions} AzureStorageQueueOptions
 */

/**
 * @param {AzureStorageQueueOptions} [options]
 * @returns {AzureStorageQueue}
 */
function azure(options) {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: config.get('HARVEST_QUEUE_NAME') || 'harvests',
    dequeueOptions: {
      numOfMessages: 32,
      visibilityTimeout: 20 * 60 // 20 min; covers p95 total processing time (~16 min over 20 days, dominated by computeLock wait)
    }
  }
  return new AzureStorageQueue(realOptions)
}

export default azure
