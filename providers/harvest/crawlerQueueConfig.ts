// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { ICache } from '../caching/index.js'
import type { AzureStorageQueueOptions } from '../queueing/azureStorageQueue.ts'
import AzureStorageQueue from '../queueing/azureStorageQueue.ts'
import type { CacheBasedHarvester } from './cacheBasedCrawler.ts'
import cacheBasedCrawler from './cacheBasedCrawler.ts'
import type { CrawlerQueueOptions } from './crawlerQueue.ts'
import crawler from './crawlerQueue.ts'

export interface CrawlerQueueConfigOptions extends Partial<CrawlerQueueOptions> {
  cachingService: ICache
}

function later(options?: AzureStorageQueueOptions): AzureStorageQueue {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: `${config.get('HARVEST_QUEUE_PREFIX') || 'cdcrawlerdev'}-later`
  }
  return new AzureStorageQueue(realOptions)
}

function normal(options?: AzureStorageQueueOptions): AzureStorageQueue {
  const realOptions = options || {
    connectionString: config.get('HARVEST_QUEUE_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    queueName: `${config.get('HARVEST_QUEUE_PREFIX') || 'cdcrawlerdev'}-normal`
  }
  return new AzureStorageQueue(realOptions)
}

function serviceFactory(options?: CrawlerQueueConfigOptions): CacheBasedHarvester {
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
