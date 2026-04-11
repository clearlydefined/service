// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from '../caching/index.js'
import type { CacheBasedHarvester } from './cacheBasedCrawler.ts'
import type { CrawlerOptions } from './crawler.js'

/** Options for the crawler service factory, combining crawler and cache settings */
export interface CrawlerConfigOptions extends Partial<CrawlerOptions> {
  /** Caching service instance passed through to the CacheBasedHarvester */
  cachingService: ICache
}

/**
 * Factory function that creates a CacheBasedHarvester backed by an HTTP crawler.
 * Reads `CRAWLER_API_AUTH_TOKEN`, `CRAWLER_API_URL`, and `HARVEST_CACHE_TTL_IN_SECONDS` from the environment.
 *
 * @param options - Options including cachingService and optional crawler overrides
 * @returns A CacheBasedHarvester instance wrapping a CrawlingHarvester
 */
declare function serviceFactory(options?: CrawlerConfigOptions): CacheBasedHarvester

export default serviceFactory
