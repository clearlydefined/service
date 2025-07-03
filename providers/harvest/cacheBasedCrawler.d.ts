// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Logger } from '../logging/logger'

/** Represents coordinates for a component */
export interface Coordinates {
  toString(): string
}

/** A harvest entry containing coordinates and related metadata */
export interface HarvestEntry {
  coordinates: Coordinates
}

/** An item representing a harvest call with associated metadata */
export interface HarvestCallItem {
  // Properties will be defined by the specific implementation
  [key: string]: any
}

/** Cache entry storing harvest information for specific coordinates */
export interface CacheEntry {
  /** The cache key identifier */
  key: string
  /** Array of harvest call items associated with this cache entry */
  harvests: HarvestCallItem[]
}

/** Service for caching operations */
export interface CachingService {
  /**
   * Retrieves a value from the cache
   *
   * @param key - The cache key
   * @returns Promise resolving to the cached value or undefined
   */
  get(key: string): Promise<any>

  /**
   * Sets a value in the cache
   *
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttl - Time to live in seconds (optional)
   * @returns Promise that resolves when the value is set
   */
  set(key: string, value: any, ttl?: number): Promise<void>

  /**
   * Deletes a value from the cache
   *
   * @param key - The cache key
   * @returns Promise that resolves when the value is deleted
   */
  delete(key: string): Promise<void>
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
  cachingService: CachingService
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
  isTracked(coordinates: Coordinates): Promise<boolean>

  /**
   * Marks harvesting as complete for the given coordinates and removes from cache
   *
   * @param coordinates - The coordinates to mark as done
   * @returns Promise that resolves when the operation is complete
   */
  done(coordinates: Coordinates): Promise<void>
}

/**
 * Factory function to create a new CacheBasedHarvester instance
 *
 * @param options - Configuration options
 * @returns A new CacheBasedHarvester instance
 */
declare function createCacheBasedHarvester(options: Options): CacheBasedHarvester

export default createCacheBasedHarvester
