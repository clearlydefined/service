// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging/index.js'
import type { IQueue } from '../queueing/index.js'
import type { HarvestCallItem, HarvestEntry, Harvester } from './cacheBasedCrawler.ts'

/** Configuration options for CrawlingQueueHarvester */
export interface CrawlerQueueOptions {
  /** Queue for immediate (turbo) harvest requests */
  normal: IQueue
  /** Queue for deferred harvest requests */
  later: IQueue
}

/** Queue-based harvester that enqueues harvest requests for asynchronous processing */
export declare class CrawlingQueueHarvester implements Harvester {
  logger: Logger
  normalQueue: IQueue
  laterQueue: IQueue

  constructor(options: CrawlerQueueOptions)

  /**
   * Enqueues harvest requests to the appropriate queue
   *
   * @param spec - The spec to harvest. Can be a single entry or an array of entries
   * @param turbo - If true, enqueues to the normal (immediate) queue; otherwise enqueues to the later queue
   */
  harvest(spec: HarvestEntry | HarvestEntry[], turbo?: boolean): Promise<void>

  /**
   * Converts a harvest entry to a harvest call item
   *
   * @param entry - The harvest entry to convert
   * @returns The harvest call item with default policy if none is provided
   */
  toHarvestItem(entry: HarvestEntry): HarvestCallItem
}

/**
 * Factory function to create a new CrawlingQueueHarvester instance
 *
 * @param options - Configuration options with normal and later queues
 * @returns A new CrawlingQueueHarvester instance
 */
declare function createCrawlerQueue(options: CrawlerQueueOptions): CrawlingQueueHarvester

export default createCrawlerQueue
