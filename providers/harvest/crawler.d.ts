// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging'
import type { HarvestCallItem, HarvestEntry, Harvester } from './cacheBasedCrawler'

/** Configuration options for CrawlingHarvester */
export interface CrawlerOptions {
  /** Authentication token for the crawler API */
  authToken: string
  /** Base URL of the crawler API */
  url: string
}

/** HTTP-based harvester that sends harvest requests to a crawler API */
export declare class CrawlingHarvester implements Harvester {
  logger: Logger
  options: CrawlerOptions

  constructor(options: CrawlerOptions)

  /**
   * Sends harvest requests to the crawler API
   *
   * @param spec - The spec to harvest. Can be a single entry or an array of entries
   * @param turbo - If true, sends to the immediate requests endpoint; otherwise sends to the deferred endpoint
   */
  harvest(spec: HarvestEntry | HarvestEntry[], turbo?: boolean): Promise<void>

  /**
   * Converts a harvest entry to a harvest call item
   *
   * @param entry - The harvest entry to convert
   * @returns The harvest call item for the crawler API
   */
  toHarvestItem(entry: HarvestEntry): HarvestCallItem
}

/**
 * Factory function to create a new CrawlingHarvester instance
 *
 * @param options - Configuration options
 * @returns A new CrawlingHarvester instance
 */
declare function createCrawler(options: CrawlerOptions): CrawlingHarvester

export default createCrawler
export = createCrawler
