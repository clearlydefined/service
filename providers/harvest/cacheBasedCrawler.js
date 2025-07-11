// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const throat = require('throat')
const { uniqBy, isEqual } = require('lodash')

/**
 * @typedef {import('../../lib/entityCoordinates').EntityCoordinates} EntityCoordinates
 *
 * @typedef {import('./cacheBasedCrawler').HarvestEntry} HarvestEntry
 *
 * @typedef {import('./cacheBasedCrawler').HarvestCallItem} HarvestCallItem
 *
 * @typedef {import('./cacheBasedCrawler').CacheEntry} CacheEntry
 *
 * @typedef {import('./cacheBasedCrawler').Options} Options
 */

/** Default cache TTL: 1 day in seconds */
const cacheTTLInSeconds = 60 * 60 * 24
/** Default concurrency limit for parallel operations */
const concurrencyLimit = 10

/**
 * Cache-based harvester that tracks and filters harvest operations to avoid duplicates. This class provides efficient
 * harvesting by caching previously processed entries and filtering out duplicates before sending them to the underlying
 * harvester.
 */
class CacheBasedHarvester {
  /**
   * Creates a new CacheBasedHarvester instance.
   *
   * @param {Options} options - Configuration options for the harvester
   */
  constructor(options) {
    this.logger = options.logger || logger()
    this._cache = options.cachingService
    this._harvester = options.harvester
    this.concurrencyLimit = options.concurrencyLimit || concurrencyLimit
    this.cacheTTLInSeconds = options.cacheTTLInSeconds || cacheTTLInSeconds
  }

  /**
   * Harvests the specified entries after filtering out duplicates and already tracked items. This method ensures that
   * only new, unique entries are processed by the underlying harvester.
   *
   * @param {HarvestEntry | HarvestEntry[]} spec - The spec to harvest. Can be a single entry or an array of entries
   * @param {boolean} [turbo] - If true, harvest in turbo mode for faster processing
   * @returns {Promise<void>} Promise that resolves when harvesting is complete
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
   * Filters out entries with duplicate coordinates, keeping only unique entries. Uses coordinates string representation
   * as the uniqueness key.
   *
   * @param {HarvestEntry[]} entries - Array of entries to filter
   * @returns {HarvestEntry[]} Array of entries with unique coordinates
   */
  _filterOutDuplicatedCoordinates(entries) {
    const validEntries = entries.filter(entry => entry?.coordinates)
    return uniqBy(validEntries, entry => this._getCacheKey(entry.coordinates))
  }

  /**
   * Filters out entries that are already being tracked in the cache. Uses concurrency limiting to avoid overwhelming
   * the cache service.
   *
   * @param {HarvestEntry[]} entries - Array of entries to filter
   * @returns {Promise<HarvestEntry[]>} Promise resolving to array of entries that are not tracked
   */
  async _filterOutTracked(entries) {
    const filteredEntries = await Promise.all(
      entries.map(throat(this.concurrencyLimit, async entry => ((await this._isTrackedHarvest(entry)) ? null : entry)))
    )
    return filteredEntries.filter(e => e)
  }

  /**
   * Checks if a harvest entry is already being tracked by comparing with cached harvest items. Uses deep equality
   * comparison to determine if the harvest is already tracked.
   *
   * @param {HarvestEntry} entry - The harvest entry to check
   * @returns {Promise<boolean>} Promise resolving to true if the harvest entry is tracked, false otherwise
   */
  async _isTrackedHarvest(entry) {
    const newHarvest = this._getHarvest(entry)
    const { harvests: trackedHarvests } = await this._getTrackedForCoordinates(entry.coordinates)
    const isTracked = trackedHarvests.some(harvest => isEqual(harvest, newHarvest))
    if (isTracked) this.logger.debug('Entry with coordinates %s is already tracked.', entry.coordinates)
    return isTracked
  }

  /**
   * Checks if the given coordinates are already being tracked in the cache.
   *
   * @param {EntityCoordinates} coordinates - The coordinates to check
   * @returns {Promise<boolean>} Promise resolving to true if the coordinates are tracked, false otherwise
   */
  async isTracked(coordinates) {
    const { harvests: trackedHarvests } = await this._getTrackedForCoordinates(coordinates)
    return trackedHarvests.length > 0
  }

  /**
   * Retrieves the tracked harvest information for the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - The coordinates to get tracked information for
   * @returns {Promise<CacheEntry>} Promise resolving to cache entry with key and tracked harvests
   */
  async _getTrackedForCoordinates(coordinates) {
    const key = this._getCacheKey(coordinates)
    const harvests = await this._getCached(key)
    return { key, harvests }
  }

  /**
   * Tracks multiple harvest entries in parallel with concurrency limiting. Logs any errors that occur during the
   * tracking process.
   *
   * @param {HarvestEntry[]} harvestEntries - Array of harvest entries to track
   * @returns {Promise<void>} Promise that resolves when all entries are tracked
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
   * Retrieves cached harvest items for the given key. Returns an empty array if the key is invalid or if an error
   * occurs.
   *
   * @param {string} key - The cache key to retrieve harvests for
   * @returns {Promise<HarvestCallItem[]>} Promise resolving to array of tracked harvest items
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
   * Tracks a single harvest entry by adding it to the cached harvest list. Creates a new harvest item and appends it to
   * existing tracked harvests.
   *
   * @param {HarvestEntry} entry - The harvest entry to track
   * @returns {Promise<void>} Promise that resolves when the entry is successfully tracked
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
   * Marks harvesting as complete for the given coordinates by removing the cache entry. This should be called when
   * harvesting is finished to clean up tracking data.
   *
   * @param {EntityCoordinates} coordinates - The coordinates to mark as complete
   * @returns {Promise<void>} Promise that resolves when the cache entry is removed
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
   * Generates a cache key for the given coordinates. The cache key format matches the one used in the definition
   * service for consistency.
   *
   * @param {EntityCoordinates} coordinates - The coordinates to generate a cache key for
   * @returns {string} The generated cache key, or empty string if coordinates are invalid
   */
  _getCacheKey(coordinates) {
    //Cache key is generated from the coordinates, same as in definition service.
    return coordinates && `hrv_${coordinates.toString().toLowerCase()}`
  }

  /**
   * Converts a harvest entry to a harvest call item using the configured harvester.
   *
   * @param {HarvestEntry} entry - The harvest entry to convert
   * @returns {HarvestCallItem} The harvest call item suitable for external API calls
   */
  _getHarvest(entry) {
    return entry && this._harvester.toHarvestItem(entry)
  }
}

/**
 * Factory function to create a new CacheBasedHarvester instance. This is the main export of the module and provides a
 * convenient way to create a new harvester with the specified configuration options.
 *
 * @param {Options} options - Configuration options for the harvester
 * @returns {CacheBasedHarvester} A new CacheBasedHarvester instance
 */
module.exports = options => new CacheBasedHarvester(options)
