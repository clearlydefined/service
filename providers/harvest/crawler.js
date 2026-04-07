// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { callFetch as requestPromise } from '../../lib/fetch.js'
import logger from '../logging/logger.js'

/**
 * @typedef {import('./crawler').CrawlerOptions} CrawlerOptions
 * @typedef {import('./cacheBasedCrawler').HarvestEntry} HarvestEntry
 * @typedef {import('./cacheBasedCrawler').HarvestCallItem} HarvestCallItem
 */

class CrawlingHarvester {
  /** @param {CrawlerOptions} options */
  constructor(options) {
    this.logger = logger()
    this.options = options
  }

  /**
   * @param {HarvestEntry | HarvestEntry[]} spec
   * @param {boolean} [turbo]
   */
  async harvest(spec, turbo) {
    const headers = {
      'X-token': this.options.authToken
    }
    const body = (Array.isArray(spec) ? spec : [spec]).map(entry => this.toHarvestItem(entry))
    const url = turbo ? `${this.options.url}/requests` : `${this.options.url}/requests/later`
    this.logger.debug(`CrawlingHarvester: Harvesting ${url} with ${JSON.stringify(body)}`)
    this.logger.debug(`CrawlingHarvester: Harvesting ${url} with ${JSON.stringify(headers)}`)
    this.logger.debug(`CrawlingHarvester: Harvesting ${turbo}`)
    return requestPromise({
      url,
      method: 'POST',
      body,
      headers,
      json: true
    })
  }

  /**
   * @param {HarvestEntry} entry
   * @returns {HarvestCallItem}
   */
  toHarvestItem(entry) {
    return {
      type: entry.tool || 'component',
      url: `cd:/${entry.coordinates.toString().replace(/[/]+/g, '/')}`,
      policy: entry.policy
    }
  }
}

export default /** @param {CrawlerOptions} options */ options => new CrawlingHarvester(options)
