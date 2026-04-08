// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import AzureStorageQueue from '../queueing/azureStorageQueue.js'
import cacheBasedCrawler from './cacheBasedCrawler.js'
import crawler from './crawlerQueue.js'

/**
 * @typedef {import('../queueing/azureStorageQueue').AzureStorageQueueOptions} AzureStorageQueueOptions
 * @typedef {import('./crawlerQueueConfig').CrawlerQueueConfigOptions} CrawlerQueueConfigOptions
 */

/**
 * @param {AzureStorageQueueOptions} [options]
 * @returns {AzureStorageQueue}
 */
function later(options) {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: `${config.get('HARVEST_QUEUE_PREFIX') || 'cdcrawlerdev'}-later`
  }
  return new AzureStorageQueue(realOptions)
}

/**
 * @param {AzureStorageQueueOptions} [options]
 * @returns {AzureStorageQueue}
 */
function normal(options) {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: `${config.get('HARVEST_QUEUE_PREFIX') || 'cdcrawlerdev'}-normal`
  }
  return new AzureStorageQueue(realOptions)
}

/**
 * @param {CrawlerQueueConfigOptions} [options]
 * @returns {import('./cacheBasedCrawler').CacheBasedHarvester}
 */
function serviceFactory(options) {
  const crawlerOptions = {
    later: options?.later || later(),
    normal: options?.normal || normal()
  }
  crawlerOptions.later.initialize()
  crawlerOptions.normal.initialize()
  const harvester = crawler(crawlerOptions)
  const cacheTTLSeconds = Number.parseInt(config.get('HARVEST_CACHE_TTL_IN_SECONDS'), 10)
  const cacheTTLInSeconds = Number.isFinite(cacheTTLSeconds) && cacheTTLSeconds > 0 ? cacheTTLSeconds : undefined
  return cacheBasedCrawler({ ...options, cacheTTLInSeconds, harvester })
}

export default serviceFactory
