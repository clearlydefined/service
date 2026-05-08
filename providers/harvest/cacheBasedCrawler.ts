// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import throat from 'throat'
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
  localLockRetryDelayMs?: number
  concurrencyLimit?: number
}

/** Default cache TTL: 1 day in seconds */
const cacheTTLInSeconds = 60 * 60 * 24
/** Default lock TTL: 1 minute in seconds */
const inflightTTLInSeconds = 60
/** Default lock retry jitter range in milliseconds */
const lockRetryDelayMinMs = 300
const lockRetryDelayMaxMs = 500
/** Default local lock retry delay in milliseconds — short since contention is in-process */
const localLockRetryDelayMs = 5
/** Default max concurrent cache reads during pre-filter. */
const concurrencyLimit = 10
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
  declare _localInflightKeys: Set<string>
  declare cacheTTLInSeconds: number
  declare inflightTTLInSeconds: number
  declare lockRetryDelayMinMs: number
  declare lockRetryDelayMaxMs: number
  declare lockAcquireTimeoutMs: number
  declare localLockRetryDelayMs: number
  declare concurrencyLimit: number

  constructor(options: Options) {
    this.logger = options.logger || logger()
    this._cache = options.cachingService
    this._harvester = options.harvester
    this._localInflightKeys = new Set()
    this.cacheTTLInSeconds = options.cacheTTLInSeconds || cacheTTLInSeconds
    this.inflightTTLInSeconds = options.inflightTTLInSeconds || inflightTTLInSeconds
    this.lockRetryDelayMinMs = options.lockRetryDelayMinMs || lockRetryDelayMinMs
    this.lockRetryDelayMaxMs = options.lockRetryDelayMaxMs || lockRetryDelayMaxMs
    this.lockAcquireTimeoutMs = options.lockAcquireTimeoutMs || lockAcquireTimeoutMs
    this.localLockRetryDelayMs = options.localLockRetryDelayMs || localLockRetryDelayMs
    this.concurrencyLimit = options.concurrencyLimit || concurrencyLimit
  }

  async harvest(spec: HarvestEntry | HarvestEntry[], turbo?: boolean): Promise<void> {
    const entries = Array.isArray(spec) ? spec : [spec]
    // _filterOutDuplicatedCoordinates removes falsy coordinates and deduplicates keys.
    const uniqueEntries = this._filterOutDuplicatedCoordinates(entries)
    if (!uniqueEntries.length) {
      this.logger.debug('No new harvests to process.')
      return
    }

    // Pre-filter: read tracking cache without holding any locks.
    // Best-effort optimisation — the recheck under the lock is the authoritative
    // guard against the TOCTOU window between here and lock acquisition.
    const candidateEntries = await this._filterOutTracked(uniqueEntries, this.concurrencyLimit)
    if (!candidateEntries.length) {
      this.logger.debug('No new harvests to process.')
      return
    }

    // Compute keys only for candidates so the lock batch is as small as possible.
    const sortedInflightKeys = candidateEntries.map(entry => this._getInflightKey(entry.coordinates)).sort()

    await this._acquireLocalInflightKeys(sortedInflightKeys)
    try {
      await this._acquireAllInflightLocks(sortedInflightKeys)
      try {
        // Recheck under lock: guards the TOCTOU window between pre-filter and lock acquisition.
        const harvests = await this._filterOutTracked(candidateEntries)
        if (!harvests.length) {
          this.logger.debug('No new harvests to process.')
          return
        }
        this.logger.debug(`Starting harvest for ${harvests.length} entries.`)
        await this._harvester.harvest(harvests, turbo)
        await this._trackHarvests(harvests)
      } finally {
        await this._releaseInflightKeys(sortedInflightKeys)
      }
    } finally {
      this._releaseLocalInflightKeys(sortedInflightKeys)
    }
  }

  async _acquireLocalInflightKeys(sortedKeys: string[]): Promise<void> {
    // Uses the same competitive retry pattern as the Redis path rather than a waiter queue.
    // Fairness and wake-up latency do not matter here: the Redis lock + tracking filter is
    // the ultimate arbiter of which request dispatches a harvest, so local acquisition order
    // has no observable effect on correctness.
    await this._acquireLocksWithRetry(
      sortedKeys,
      keys => this._acquireSortedLocalInflightKeys(keys),
      keys => this._releaseLocalInflightKeys(keys),
      this.localLockRetryDelayMs,
      'local inflight'
    )
  }

  _acquireSortedLocalInflightKeys(sortedKeys: string[]): string[] {
    const acquired: string[] = []
    for (const key of sortedKeys) {
      if (this._localInflightKeys.has(key)) {
        break
      }
      this._localInflightKeys.add(key)
      acquired.push(key)
    }
    return acquired
  }

  _releaseLocalInflightKeys(keys: string[]): void {
    for (const key of keys) {
      this._localInflightKeys.delete(key)
    }
  }

  async _acquireAllInflightLocks(sortedKeys: string[]): Promise<void> {
    await this._acquireLocksWithRetry(
      sortedKeys,
      keys => this._acquireSortedInflightKeys(keys),
      keys => this._releaseInflightKeys(keys),
      () => this._getLockRetryDelayMs(),
      'inflight'
    )
  }

  async _acquireLocksWithRetry(
    sortedKeys: string[],
    tryAcquire: (keys: string[]) => Promise<string[]> | string[],
    release: (keys: string[]) => Promise<void> | void,
    retryDelayMs: number | (() => number),
    label: string
  ): Promise<void> {
    const started = Date.now()
    let attempts = 0

    while (true) {
      attempts += 1
      const acquired = await tryAcquire(sortedKeys)
      if (acquired.length === sortedKeys.length) {
        this.logger.debug(
          `Acquired ${acquired.length}/${sortedKeys.length} ${label} lock(s) after ${attempts} attempt(s) in ${Date.now() - started}ms.`
        )
        return
      }

      const missedKey = acquired.length > 0 ? sortedKeys[acquired.length] : 'unknown'
      this.logger.debug(
        `${label} lock miss on attempt ${attempts}: acquired ${acquired.length}/${sortedKeys.length}; first missed key ${missedKey}; releasing partial locks.`
      )
      await release(acquired)

      if (Date.now() - started >= this.lockAcquireTimeoutMs) {
        throw new Error(
          `Timed out acquiring ${label} harvest coordinate locks after ${attempts} attempt(s) in ${Date.now() - started}ms`
        )
      }
      const delay = typeof retryDelayMs === 'function' ? retryDelayMs() : retryDelayMs
      this.logger.debug(
        `Retrying ${label} lock acquisition in ${delay}ms (attempt ${attempts + 1}, elapsed ${Date.now() - started}ms).`
      )
      await this._sleep(delay)
    }
  }

  async _acquireSortedInflightKeys(sortedKeys: string[]): Promise<string[]> {
    try {
      const allAcquired = await this._cache.setIfAbsentBatch(sortedKeys, '1', this.inflightTTLInSeconds)
      return allAcquired ? sortedKeys : []
    } catch (error) {
      // Lua may have acquired some keys before throwing — release all to be safe (DEL is idempotent).
      await this._releaseInflightKeys(sortedKeys)
      throw error
    }
  }

  async _releaseInflightKeys(keys: string[]): Promise<void> {
    const results = await Promise.allSettled(keys.map(key => this._cache.delete(key)))
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error('Error releasing inflight lock', result.reason)
      }
    }
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

  async _filterOutTracked(entries: HarvestEntry[], concurrency?: number): Promise<HarvestEntry[]> {
    // Skip throat when entries are already at/below the limit to avoid unnecessary wrapping.
    const isConcurrencyValid = concurrency !== undefined && concurrency > 0 && concurrency < entries.length
    const mapper = async (entry: HarvestEntry) => ((await this._isTrackedHarvest(entry)) ? null : entry)
    const filteredEntries = await Promise.all(entries.map(isConcurrencyValid ? throat(concurrency!, mapper) : mapper))

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
    const results = await Promise.allSettled(harvestEntries.map(entry => this._track(entry)))
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
