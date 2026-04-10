// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import logger from '../logging/logger.ts'

/**
 * @typedef {import('./crawlerQueue').CrawlerQueueOptions} CrawlerQueueOptions
 * @typedef {import('./cacheBasedCrawler').HarvestEntry} HarvestEntry
 * @typedef {import('./cacheBasedCrawler').HarvestCallItem} HarvestCallItem
 */

class CrawlingQueueHarvester {
  /** @param {CrawlerQueueOptions} options */
  constructor(options) {
    this.logger = logger()
    this.normalQueue = options.normal
    this.laterQueue = options.later
  }

  /**
   * @param {HarvestEntry | HarvestEntry[]} spec
   * @param {boolean} [turbo]
   */
  async harvest(spec, turbo) {
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

  /**
   * @param {HarvestEntry} entry
   * @returns {HarvestCallItem}
   */
  toHarvestItem(entry) {
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

export default /** @param {CrawlerQueueOptions} options */ options => new CrawlingQueueHarvester(options)
