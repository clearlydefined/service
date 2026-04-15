// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { ICache } from '../caching/index.js'
import type { CacheBasedHarvester } from './cacheBasedCrawler.ts'
import cacheBasedCrawler from './cacheBasedCrawler.ts'
import type { CrawlerOptions } from './crawler.ts'
import crawler from './crawler.ts'

export interface CrawlerConfigOptions extends Partial<CrawlerOptions> {
  cachingService: ICache
}

const crawlerConfig: CrawlerOptions = {
  authToken: config.get('CRAWLER_API_AUTH_TOKEN')!,
  url: config.get('CRAWLER_API_URL') || 'http://localhost:5000'
}

function serviceFactory(options?: CrawlerConfigOptions): CacheBasedHarvester {
  const crawlerOptions = { ...crawlerConfig, ...options }
  const harvester = crawler(crawlerOptions)
  const cacheTTLSeconds = Number.parseInt(config.get('HARVEST_CACHE_TTL_IN_SECONDS')!, 10)
  const cacheTTLInSeconds = Number.isFinite(cacheTTLSeconds) && cacheTTLSeconds > 0 ? cacheTTLSeconds : undefined
  return cacheBasedCrawler({ ...options, cacheTTLInSeconds, harvester } as import('./cacheBasedCrawler.ts').Options)
}

export default serviceFactory
