// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
// @ts-check
const logger = require('../logging/logger')
const throat = require('throat')
const { uniqBy, isEqual } = require('lodash')

const cacheTTLInSeconds = 60 * 60 * 24 /* 1d */
const concurrencyLimit = 10

/**
 *  @typedef {Object} Harvester
 *  @property {function} harvest - Function to harvest entries.
 *  @property {function} toHarvestItem - Function to convert entry to message body for external api call.
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
 * @property {number} [cacheTTLInSeconds] - Optional cache TTL in seconds.
 */

/**
 * @typedef {Object} HarvestEntry
 * @property {Coordinates} coordinates
 */

/**
 * @typedef {Object} Coordinates
 */

/**
 * @typedef {Object} CacheEntry
 * @property {string} key
 * @property {HarvestCallItem[]} harvests
 */

/**
 * @typedef {Object} HarvestCallItem
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
    this.cacheTTLInSeconds = options.cacheTTLInSeconds || cacheTTLInSeconds
  }

  /**
   * @param {*} spec - The spec to harvest. Can be a single entry or an array of entries.
   * @param {boolean} turbo - If true, harvest in turbo mode.
   */
  async harvest(spec, turbo) {
    const entries = Array.isArray(spec) ? spec : [spec]
    const uniqueEntries = this._filterOutDuplicatedCoordinates(entries)
    const harvests = await this._filterOutTracked(uniqueEntries)
    if (!harvests.length) {
      this.logger.debug('No new harvests to process.')
      return
    }
    this.logger.debug(`Starting harvest for ${harvests.length} entries.`)
    await this._harvester.harvest(harvests, turbo)
    await this._trackHarvests(harvests)
  }

  /**
   * @param {HarvestEntry[]} entries - Array of entries to filter.
   * @returns {HarvestEntry[]} - An array of entries with unique coordinates.
   */
  _filterOutDuplicatedCoordinates(entries) {
    const validEntries = entries.filter(entry => entry?.coordinates)
    return uniqBy(validEntries, entry => this._getCacheKey(entry.coordinates))
  }

  /**
   * @param {HarvestEntry[]} entries - Array of entries to filter.
   * @returns {Promise<HarvestEntry[]>} - A promise that resolves to an array of entries that are not tracked.
   */
  async _filterOutTracked(entries) {
    const filteredEntries = await Promise.all(
      entries.map(throat(this.concurrencyLimit, async entry => ((await this._isTrackedHarvest(entry)) ? null : entry)))
    )
    //@ts-ignore
    return filteredEntries.filter(e => e)
  }

  /**
   *
   * @param {HarvestEntry} entry
   * @returns {Promise<boolean>} whether the harvest entry has been tracked
   */
  async _isTrackedHarvest(entry) {
    const newHarvest = this._getHarvest(entry)
    const { harvests: trackedHarvests } = await this._getTrackedForCoordinates(entry.coordinates)
    const isTracked = trackedHarvests.some(harvest => isEqual(harvest, newHarvest))
    if (isTracked) this.logger.debug('Entry with coordinates %s is already tracked.', entry.coordinates)
    return isTracked
  }

  /**
   * @param {Coordinates} coordinates - The coordinates to check.
   * @returns {Promise<boolean>} - A promise that resolves to true if the coordinates is tracked, false otherwise.
   */
  async isTracked(coordinates) {
    const { harvests: trackedHarvests } = await this._getTrackedForCoordinates(coordinates)
    return trackedHarvests.length > 0
  }

  /**
   *
   * @param {Coordinates} coordinates
   * @returns {Promise<CacheEntry>}
   */
  async _getTrackedForCoordinates(coordinates) {
    const key = this._getCacheKey(coordinates)
    const harvests = await this._getCached(key)
    return { key, harvests }
  }

  /**
   * @param {HarvestEntry[]} harvestEntries - Array of items to track.
   */
  async _trackHarvests(harvestEntries) {
    const results = await Promise.allSettled(
      harvestEntries.map(
        throat(this.concurrencyLimit, async entry => {
          await this._track(entry)
        })
      )
    )
    results.forEach(result => {
      if (result.status === 'rejected') this.logger.error(result.reason)
    })
  }

  /**
   *
   * @param {string} key
   * @returns {Promise<HarvestCallItem[]} tracked harvests
   */
  async _getCached(key) {
    if (!key) return []
    try {
      const harvests = await this._cache.get(key)
      return harvests || []
    } catch (error) {
      this.logger.error(`Error checking tracked harvests for ${key}:`, error)
      return []
    }
  }

  /**
   * @param {HarvestEntry} entry - The entry to track.
   * @returns {Promise<void>} - A promise that resolves when the cache is set.
   */
  async _track(entry) {
    const newHarvest = this._getHarvest(entry)
    const { key, harvests } = await this._getTrackedForCoordinates(entry.coordinates)
    try {
      harvests.push(newHarvest)
      await this._cache.set(key, harvests, this.cacheTTLInSeconds)
      this.logger.debug(`Cached ${key} with ${harvests.length} harvests.`)
    } catch (error) {
      this.logger.error(`Error caching ${key}:`, error)
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
      this.logger.debug(`Removed cache for ${cacheKey}.`)
    } catch (error) {
      this.logger.error(`Error removing cache for ${cacheKey}:`, error)
    }
  }

  /**
   * @param {Coordinates} coordinates - The coordinates to generate a cache key for.
   * @returns {string} - The cache key.
   */
  _getCacheKey(coordinates) {
    //Cache key is generated from the coordinates, same as in definition service.
    return coordinates && `hrv_${coordinates.toString().toLowerCase()}`
  }

  /**
   *
   * @param {HarvestEntry} entry
   * @returns {HarvestCallItem} - The harvest item.
   */
  _getHarvest(entry) {
    return entry && this._harvester.toHarvestItem(entry)
  }
}

/**
 * @param {Options} options
 */
module.exports = options => new CacheBasedHarvester(options)
