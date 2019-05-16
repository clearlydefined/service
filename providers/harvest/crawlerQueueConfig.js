// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const AzureStorageQueue = require('../queueing/azureStorageQueue')
const crawler = require('./crawlerQueue')

function later(options) {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: `${config.get('HARVEST_QUEUE_PREFIX') || 'cdcrawlerdev'}-later`
  }
  return new AzureStorageQueue(realOptions)
}

function normal(options) {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: `${config.get('HARVEST_QUEUE_PREFIX') || 'cdcrawlerdev'}-normal`
  }
  return new AzureStorageQueue(realOptions)
}

function serviceFactory(options) {
  const realOptions = options || {
    later: later(),
    normal: normal()
  }
  realOptions.later.initialize()
  realOptions.normal.initialize()
  return crawler(realOptions)
}

module.exports = serviceFactory
