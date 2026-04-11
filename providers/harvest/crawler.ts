// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { callFetch as requestPromise } from '../../lib/fetch.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { HarvestCallItem, HarvestEntry, Harvester } from './cacheBasedCrawler.ts'

export interface CrawlerOptions {
  authToken: string
  url: string
}

export class CrawlingHarvester implements Harvester {
  declare logger: Logger
  declare options: CrawlerOptions

  constructor(options: CrawlerOptions) {
    this.logger = logger()
    this.options = options
  }

  async harvest(spec: HarvestEntry | HarvestEntry[], turbo?: boolean) {
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

  toHarvestItem(entry: HarvestEntry): HarvestCallItem {
    return {
      type: entry.tool || 'component',
      url: `cd:/${entry.coordinates.toString().replace(/[/]+/g, '/')}`,
      policy: entry.policy
    }
  }
}

export default (options: CrawlerOptions): CrawlingHarvester => new CrawlingHarvester(options)
