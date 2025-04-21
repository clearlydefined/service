// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const throat = require('throat')

const cacheTTLInSeconds = 60 * 60 * 24 /* 1d */
const concurrencyLimit = 10

class CacheBasedHarvester {
  constructor(options) {
    this.logger = options.logger || logger()
    this._cache = options.cachingService
    this._harvester = options.harvester
    this.concurrencyLimit = options.concurrencyLimit || concurrencyLimit
  }

  async harvest(spec, turbo) {
    const entries = Array.isArray(spec) ? spec : [spec]
    const harvests = await this._filterOutTracked(entries)
    if (!harvests.length) {
      this.logger.debug('No new harvests to process.')
      return
    }
    this.logger.debug(`Starting harvest for ${harvests.length} entries.`)
    await this._harvester.harvest(harvests, turbo)
    await this._trackHarvests(harvests)
  }

  async _trackHarvests(harvestItems) {
    const results = await Promise.allSettled(
      harvestItems.map(
        throat(this.concurrencyLimit, async entry => {
          await this._track(entry)
        })
      )
    )
    results.filter(result => result.status === 'rejected').forEach(result => this.logger.error(result.reason))
  }

  async _filterOutTracked(entries) {
    const filteredEntries = await Promise.all(
      entries.map(throat(this.concurrencyLimit, async entry => ((await this.isTracked(entry)) ? null : entry)))
    )
    return filteredEntries.filter(e => e)
  }

  async isTracked(entry) {
    const cacheKey = this._getCacheKey(entry)
    if (!cacheKey) return false
    try {
      const cached = await this._cache.get(cacheKey)
      return cached || false
    } catch (error) {
      this.logger.error(`Error checking tracking status for ${cacheKey}:`, error)
      return false
    }
  }

  async _track(entry) {
    const cacheKey = this._getCacheKey(entry)
    if (!cacheKey) return
    try {
      await this._cache.set(cacheKey, true, cacheTTLInSeconds)
    } catch (error) {
      this.logger.error(`Error caching coordinates ${cacheKey}:`, error)
    }
  }

  async done(entry) {
    const cacheKey = this._getCacheKey(entry)
    if (!cacheKey) return
    try {
      await this._cache.delete(cacheKey)
    } catch (error) {
      this.logger.error(`Error removing cache for coordinates ${cacheKey}:`, error)
    }
  }

  _getCacheKey(entry) {
    const url = this._harvester.toUrl(entry)
    return url && `hrv_${url}`
  }
}

module.exports = options => new CacheBasedHarvester(options)
