// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates'
import type { ICache } from '../caching'
import type { Logger } from '../logging'

/** Policy configuration for a harvest operation */
export interface HarvestPolicy {
  fetch?: string
  freshness?: string
  map?: { name: string; path: string }
}

/** A harvest entry containing coordinates and related metadata */
export interface HarvestEntry {
  coordinates: EntityCoordinates
  /** Tool identifier (e.g., 'component', 'scancode'). Defaults to 'component' when absent */
  tool?: string
  /** Harvest policy configuration */
  policy?: HarvestPolicy
}

/** An item representing a harvest call with associated metadata */
export interface HarvestCallItem {
  /** Tool or component type for the harvest (e.g., 'component') */
  type: string
  /** ClearlyDefined URL for the component (e.g., 'cd:/npm/npmjs/-/lodash/4.17.21') */
  url: string
  /** Harvest policy configuration */
  policy?: HarvestPolicy
}

/** Cache entry storing harvest information for specific coordinates */
export interface CacheEntry {
  /** The cache key identifier */
  key: string
  /** Array of harvest call items associated with this cache entry */
  harvests: HarvestCallItem[]
}

/** Service for harvesting component data */
export interface Harvester {
  /**
   * Harvests data for the given entries
   *
   * @param entries - Array of harvest entries to process
   * @param turbo - Whether to use turbo mode for faster processing
   * @returns Promise that resolves when harvesting is complete
   */
  harvest(entries: HarvestEntry[], turbo?: boolean): Promise<void>

  /**
   * Converts an entry to a harvest item for external API calls
   *
   * @param entry - The harvest entry to convert
   * @returns The harvest call item
   */
  toHarvestItem(entry: HarvestEntry): HarvestCallItem
}

/** Configuration options for the CacheBasedHarvester */
export interface Options {
  /** Optional logger instance. If not provided, a default logger will be used */
  logger?: Logger
  /** Caching service instance for storing harvest tracking data */
  cachingService: ICache
  /** Harvester instance for processing harvest operations */
  harvester: Harvester
  /** Optional concurrency limit for parallel operations. Defaults to 10 */
  concurrencyLimit?: number
  /** Optional cache TTL in seconds. Defaults to 86400 (1 day) */
  cacheTTLInSeconds?: number
}

/** Main class for cache-based harvesting operations */
export declare class CacheBasedHarvester {
  constructor(options: Options)

  /**
   * Harvests the specified entries, filtering out duplicates and already tracked items
   *
   * @param spec - The spec to harvest. Can be a single entry or an array of entries
   * @param turbo - If true, harvest in turbo mode for faster processing
   * @returns Promise that resolves when harvesting is complete
   */
  harvest(spec: HarvestEntry | HarvestEntry[], turbo?: boolean): Promise<void>

  /**
   * Checks if the given coordinates are already being tracked
   *
   * @param coordinates - The coordinates to check
   * @returns Promise resolving to true if tracked, false otherwise
   */
  isTracked(coordinates: EntityCoordinates): Promise<boolean>

  /**
   * Marks harvesting as complete for the given coordinates and removes from cache
   *
   * @param coordinates - The coordinates to mark as done
   * @returns Promise that resolves when the operation is complete
   */
  done(coordinates: EntityCoordinates): Promise<void>
}

/**
 * Factory function to create a new CacheBasedHarvester instance
 *
 * @param options - Configuration options
 * @returns A new CacheBasedHarvester instance
 */
declare function createCacheBasedHarvester(options: Options): CacheBasedHarvester

export default createCacheBasedHarvester
export = createCacheBasedHarvester
