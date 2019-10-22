// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const AzureStorageQueue = require('../queueing/azureStorageQueue')

function azure(options) {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: config.get('HARVEST_QUEUE_NAME') || 'harvests',
    dequeueOptions: {
      numOfMessages: 32,
      visibilityTimeout: 10 * 60, // 10 min. The default value is 30 seconds.
    }
  }
  return new AzureStorageQueue(realOptions)
}

module.exports = azure
