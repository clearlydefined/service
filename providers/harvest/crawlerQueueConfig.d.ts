// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { IQueue } from '../queueing'
import { ICache } from '../caching'
import { CacheBasedHarvester } from './cacheBasedCrawler'

/** Configuration options for the queue-based crawler service factory */
export interface CrawlerQueueConfigOptions {
  /** Optional override for the deferred queue. Defaults to an Azure Storage queue from environment config */
  later?: IQueue
  /** Optional override for the immediate queue. Defaults to an Azure Storage queue from environment config */
  normal?: IQueue
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
