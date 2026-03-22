// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from '../caching'
import type { CacheBasedHarvester } from './cacheBasedCrawler'
import type { CrawlerQueueOptions } from './crawlerQueue'

/** Configuration options for the queue-based crawler service factory */
export interface CrawlerQueueConfigOptions extends Partial<CrawlerQueueOptions> {
  /** Caching service instance passed through to the CacheBasedHarvester */
  cachingService: ICache
}

/**
 * Factory function that creates a CacheBasedHarvester backed by queue-based crawling.
 * Reads `HARVEST_QUEUE_CONNECTION_STRING`, `HARVEST_AZBLOB_CONNECTION_STRING`,
 * `HARVEST_QUEUE_PREFIX`, and `HARVEST_CACHE_TTL_IN_SECONDS` from the environment.
 *
 * @param options - Options including cachingService and optional queue overrides
 * @returns A CacheBasedHarvester instance wrapping a CrawlingQueueHarvester
 */
declare function serviceFactory(options?: CrawlerQueueConfigOptions): CacheBasedHarvester

export = serviceFactory
