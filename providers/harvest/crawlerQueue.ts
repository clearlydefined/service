// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { IQueue } from '../queueing/index.js'
import type { HarvestCallItem, HarvestEntry, Harvester } from './cacheBasedCrawler.ts'

export interface CrawlerQueueOptions {
  normal: IQueue
  later: IQueue
}

export class CrawlingQueueHarvester implements Harvester {
  declare logger: Logger
  declare normalQueue: IQueue
  declare laterQueue: IQueue

  constructor(options: CrawlerQueueOptions) {
    this.logger = logger()
    this.normalQueue = options.normal
    this.laterQueue = options.later
  }

  async harvest(spec: HarvestEntry | HarvestEntry[], turbo?: boolean): Promise<void> {
    const entries = Array.isArray(spec) ? spec : [spec]
    for (const entry of entries) {
      const message = JSON.stringify(this.toHarvestItem(entry))
      if (turbo) {
        this.normalQueue.queue(message)
      } else {
        this.laterQueue.queue(message)
      }
    }
  }

  toHarvestItem(entry: HarvestEntry): HarvestCallItem {
    return {
      type: entry.tool || 'component',
      url: `cd:/${entry.coordinates.toString().replace(/[/]+/g, '/')}`,
      policy: entry.policy || {
        fetch: 'mutables',
        freshness: 'match',
        map: { name: entry.tool || 'component', path: '/' }
      }
    }
  }
}

export default (options: CrawlerQueueOptions): CrawlingQueueHarvester => new CrawlingQueueHarvester(options)
