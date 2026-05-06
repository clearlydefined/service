// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { ICache } from '../caching/index.js'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'

const { uniqBy, isEqual } = lodash

export interface HarvestPolicy {
  fetch?: string
  freshness?: string
  map?: { name: string; path: string }
}

export interface HarvestEntry {
  coordinates: EntityCoordinates | string
  tool?: string
  policy?: HarvestPolicy
}

export interface HarvestCallItem {
  type: string
  url: string
  policy?: HarvestPolicy
}

export interface CacheEntry {
  key: string
  harvests: HarvestCallItem[]
}

export interface Harvester {
  harvest(entries: HarvestEntry | HarvestEntry[], turbo?: boolean): Promise<void>
  toHarvestItem(entry: HarvestEntry): HarvestCallItem
}

export interface Options {
  logger?: Logger
  cachingService: ICache
  harvester: Harvester
  cacheTTLInSeconds?: number
  inflightTTLInSeconds?: number
  lockRetryDelayMinMs?: number
  lockRetryDelayMaxMs?: number
  lockAcquireTimeoutMs?: number
}

/** Default cache TTL: 1 day in seconds */
const cacheTTLInSeconds = 60 * 60 * 24
/** Default lock TTL: 5 minutes in seconds */
const inflightTTLInSeconds = 60 * 5
/** Default lock retry delay range in milliseconds */
const lockRetryDelayMinMs = 50
const lockRetryDelayMaxMs = 250
/**
 * Default maximum lock acquire wait in milliseconds.
 * Keep this below upstream request timeouts so callers receive a structured error.
 */
const lockAcquireTimeoutMs = 30 * 1000

/**
 * Cache-based harvester that tracks and filters harvest operations to avoid duplicates. This class provides efficient
 * harvesting by caching previously processed entries and filtering out duplicates before sending them to the underlying
 * harvester.
 */
export class CacheBasedHarvester {
  declare logger: Logger
  declare _cache: ICache
  declare _harvester: Harvester
  declare cacheTTLInSeconds: number
  declare inflightTTLInSeconds: number
  declare lockRetryDelayMinMs: number
  declare lockRetryDelayMaxMs: number
  declare lockAcquireTimeoutMs: number

  constructor(options: Options) {
    this.logger = options.logger || logger()
    this._cache = options.cachingService
    this._harvester = options.harvester
    this.cacheTTLInSeconds = options.cacheTTLInSeconds || cacheTTLInSeconds
    this.inflightTTLInSeconds = options.inflightTTLInSeconds || inflightTTLInSeconds
    this.lockRetryDelayMinMs = options.lockRetryDelayMinMs || lockRetryDelayMinMs
    this.lockRetryDelayMaxMs = options.lockRetryDelayMaxMs || lockRetryDelayMaxMs
    this.lockAcquireTimeoutMs = options.lockAcquireTimeoutMs || lockAcquireTimeoutMs
  }

  async harvest(spec: HarvestEntry | HarvestEntry[], turbo?: boolean): Promise<void> {
    const entries = Array.isArray(spec) ? spec : [spec]
    const uniqueEntries = this._filterOutDuplicatedCoordinates(entries)
    if (!uniqueEntries.length) {
      this.logger.debug('No new harvests to process.')
      return
    }

    await this._acquireAllInflightLocks(uniqueEntries)
    try {
      const harvests = await this._filterOutTracked(uniqueEntries)
      if (!harvests.length) {
        this.logger.debug('No new harvests to process.')
        return
      }
      this.logger.debug(`Starting harvest for ${harvests.length} entries.`)
      await this._harvester.harvest(harvests, turbo)
      await this._trackHarvests(harvests)
    } finally {
      await this._releaseInflightLocks(uniqueEntries)
    }
  }

  async _acquireAllInflightLocks(entries: HarvestEntry[]): Promise<void> {
    const started = Date.now()
    const sortedKeys = [
      ...new Set(entries.map(entry => this._getInflightKey(entry.coordinates)).filter(Boolean))
    ].sort()

    while (true) {
      const acquired = await this._acquireSortedInflightKeys(sortedKeys)
      if (acquired.length === sortedKeys.length) {
        return
      }

      await this._releaseInflightKeys(acquired)
      if (Date.now() - started >= this.lockAcquireTimeoutMs) {
        throw new Error(`Timed out acquiring harvest coordinate locks after ${this.lockAcquireTimeoutMs}ms`)
      }
      await this._sleep(this._getLockRetryDelayMs())
    }
  }

  async _acquireSortedInflightKeys(sortedKeys: string[]): Promise<string[]> {
    const acquired: string[] = []
    try {
      for (const key of sortedKeys) {
        const lockAcquired = await this._cache.setIfAbsent(key, '1', this.inflightTTLInSeconds)
        if (!lockAcquired) {
          break
        }
        acquired.push(key)
      }
      return acquired
    } catch (error) {
      await this._releaseInflightKeys(acquired)
      throw error
    }
  }

  async _releaseInflightLocks(entries: HarvestEntry[]): Promise<void> {
    const keys = entries.map(entry => this._getInflightKey(entry.coordinates))
    await this._releaseInflightKeys(keys)
  }

  async _releaseInflightKeys(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this._cache.delete(key)))
  }

  _getInflightKey(coordinates: EntityCoordinates | string): string {
    if (!coordinates) {
      return ''
    }
    return `hrv_inflight_${coordinates.toString().toLowerCase()}`
  }

  _getLockRetryDelayMs(): number {
    if (this.lockRetryDelayMaxMs <= this.lockRetryDelayMinMs) {
      return this.lockRetryDelayMinMs
    }
    return this.lockRetryDelayMinMs + Math.floor(Math.random() * (this.lockRetryDelayMaxMs - this.lockRetryDelayMinMs))
  }

  _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  _filterOutDuplicatedCoordinates(entries: HarvestEntry[]): HarvestEntry[] {
    const validEntries = entries.filter(entry => entry?.coordinates)
    return uniqBy(validEntries, entry => this._getCacheKey(entry.coordinates))
  }

  async _filterOutTracked(entries: HarvestEntry[]): Promise<HarvestEntry[]> {
    const filteredEntries = await Promise.all(
      entries.map(async (entry: HarvestEntry) => ((await this._isTrackedHarvest(entry)) ? null : entry))
    )
    return filteredEntries.filter((entry): entry is HarvestEntry => entry !== null)
  }

  async _isTrackedHarvest(entry: HarvestEntry): Promise<boolean> {
    const newHarvest = this._getHarvest(entry)
    const { harvests: trackedHarvests } = await this._getTrackedForCoordinates(entry.coordinates)
    const isTracked = trackedHarvests.some(harvest => isEqual(harvest, newHarvest))
    if (isTracked) {
      this.logger.debug(`Entry with coordinates ${entry.coordinates.toString()} is already tracked.`)
    }
    return isTracked
  }

  async isTracked(coordinates: EntityCoordinates): Promise<boolean> {
    const { harvests: trackedHarvests } = await this._getTrackedForCoordinates(coordinates)
    return trackedHarvests.length > 0
  }

  async _getTrackedForCoordinates(coordinates: EntityCoordinates | string): Promise<CacheEntry> {
    const key = this._getCacheKey(coordinates)
    const harvests = await this._getCached(key)
    return { key, harvests }
  }

  async _trackHarvests(harvestEntries: HarvestEntry[]): Promise<void> {
    const results = await Promise.allSettled(
      harvestEntries.map(async (entry: HarvestEntry) => {
        await this._track(entry)
      })
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(result.reason)
      }
    }
  }

  async _getCached(key: string): Promise<HarvestCallItem[]> {
    if (!key) {
      return []
    }
    try {
      const harvests = await this._cache.get(key)
      return harvests || []
    } catch (error) {
      this.logger.error(`Error checking tracked harvests for ${key}:`, error)
      return []
    }
  }

  async _track(entry: HarvestEntry): Promise<void> {
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

  async done(coordinates: EntityCoordinates): Promise<void> {
    const cacheKey = this._getCacheKey(coordinates)
    if (!cacheKey) {
      return
    }
    try {
      await this._cache.delete(cacheKey)
      this.logger.debug(`Removed cache for ${cacheKey}.`)
    } catch (error) {
      this.logger.error(`Error removing cache for ${cacheKey}:`, error)
    }
  }

  _getCacheKey(coordinates: EntityCoordinates | string): string {
    //Cache key is generated from the coordinates, same as in definition service.
    return coordinates && `hrv_${coordinates.toString().toLowerCase()}`
  }

  _getHarvest(entry: HarvestEntry): HarvestCallItem {
    return entry && this._harvester.toHarvestItem(entry)
  }
}

export default (options: Options): CacheBasedHarvester => new CacheBasedHarvester(options)
