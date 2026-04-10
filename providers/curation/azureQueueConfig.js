// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('../queueing/azureStorageQueue').AzureStorageQueueOptions} AzureStorageQueueOptions */

import config from 'painless-config'
import AzureStorageQueue from '../queueing/azureStorageQueue.ts'

/** @param {AzureStorageQueueOptions} [options] */
function azure(options) {
  const realOptions = options || {
    connectionString: config.get('CURATION_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: config.get('CURATION_QUEUE_NAME') || 'curations'
  }
  return new AzureStorageQueue(realOptions)
}

export default azure
