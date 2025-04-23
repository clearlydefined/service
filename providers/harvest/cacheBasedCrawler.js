// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
// @ts-check
const logger = require('../logging/logger')
const throat = require('throat')

const cacheTTLInSeconds = 60 * 60 * 24 /* 1d */
const concurrencyLimit = 10

/**
 *  @typedef {Object} Harvester
 *  @property {function} harvest - Function to harvest entries.
 *  @property {function} toUrl - Function to convert entry to URL.
 */

/**
 * @typedef {Object} CachingService
 * @property {function} get - Function to get a value from the cache.
 * @property {function} set - Function to set a value in the cache.
 * @property {function} delete - Function to delete a value from the cache.
 */

/**
 * @typedef {Object} Options
 * @property {Object} [logger] - Optional logger instance.
 * @property {CachingService} cachingService - Caching service instance.
 * @property {Harvester} harvester - Harvester instance.
 * @property {number} [concurrencyLimit] - Optional concurrency limit.
 */

/**
 * @typedef {Object} HarvestEntry
 * @property {Object} coordinates
 */

/**
 * @typedef {Object} Coordinates
 */

class CacheBasedHarvester {
  /**
   * @param {Options} options
   */
  constructor(options) {
    this.logger = options.logger || logger()
    this._cache = options.cachingService
    this._harvester = options.harvester
    this.concurrencyLimit = options.concurrencyLimit || concurrencyLimit
  }

  /**
   * @param {*} spec - The spec to harvest. Can be a single entry or an array of entries.
   * @param {boolean} turbo - If true, harvest in turbo mode.
   */
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

  /**
   * @param {HarvestEntry[]} harvestEntries - Array of items to track.
   */
  async _trackHarvests(harvestEntries) {
    const results = await Promise.allSettled(
      harvestEntries.map(
        throat(this.concurrencyLimit, async entry => {
          await this._track(entry.coordinates)
        })
      )
    )
    results.forEach(result => {
      if (result.status === 'rejected') this.logger.error(result.reason)
    })
  }

  /**
   * @param {HarvestEntry[]} entries - Array of entries to filter.
   * @returns {Promise<HarvestEntry[]>} - A promise that resolves to an array of entries that are not tracked.
   */
  async _filterOutTracked(entries) {
    const filteredEntries = await Promise.all(
      entries.map(
        throat(this.concurrencyLimit, async entry => {
          const tracked = await this.isTracked(entry?.coordinates)
          return tracked ? null : entry
        })
      )
    )
    //@ts-ignore
    return filteredEntries.filter(e => e !== null)
  }

  /**
   * @param {Coordinates} coordinates - The coordinates to check.
   * @returns {Promise<boolean>} - A promise that resolves to true if the coordinates is tracked, false otherwise.
   */
  async isTracked(coordinates) {
    const cacheKey = this._getCacheKey(coordinates)
    if (!cacheKey) return false
    try {
      const cached = await this._cache.get(cacheKey)
      return cached || false
    } catch (error) {
      this.logger.error(`Error checking tracking status for ${cacheKey}:`, error)
      return false
    }
  }

  /**
   * @param {Coordinates} coordinates - The entry to track.
   * @returns {Promise<void>} - A promise that resolves when the cache is set.
   */
  async _track(coordinates) {
    const cacheKey = this._getCacheKey(coordinates)
    if (!cacheKey) return
    try {
      await this._cache.set(cacheKey, true, cacheTTLInSeconds)
    } catch (error) {
      this.logger.error(`Error caching ${cacheKey}:`, error)
    }
  }

  /**
   * @param {Coordinates} coordinates - The entry to remove from the cache.
   * @returns {Promise<void>} - A promise that resolves when the cache is removed.
   */
  async done(coordinates) {
    const cacheKey = this._getCacheKey(coordinates)
    if (!cacheKey) return
    try {
      await this._cache.delete(cacheKey)
    } catch (error) {
      this.logger.error(`Error removing cache for ${cacheKey}:`, error)
    }
  }

  /**
   * @param {Coordinates} coordinates - The coordinates to generate a cache key for.
   * @returns {string} - The cache key.
   */
  _getCacheKey(coordinates) {
    const url = this._harvester.toUrl(coordinates)
    return url && `hrv_${url}`
  }
}

/**
 * @param {Options} options
 */
module.exports = options => new CacheBasedHarvester(options)
