// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from '../providers/caching'
import type { Logger } from '../providers/logging'

/** Options for the StatusService */
export interface StatusServiceOptions {
  /** Application Insights service ID */
  serviceId: string
  /** Application Insights service API key */
  serviceKey: string
  /** Application Insights crawler ID */
  crawlerId: string
  /** Application Insights crawler API key */
  crawlerKey: string
}

/** Request count data - date to count mapping */
export type RequestCountData = Record<string, number>

/** Processed per day entry */
export interface ProcessedPerDayEntry {
  /** The date */
  date: string
  /** Counts per crawler host */
  [host: string]: string | number
}

/** Recently crawled entry */
export interface RecentlyCrawledEntry {
  /** Component coordinates */
  coordinates: string
  /** Timestamp of when it was crawled */
  timestamp: string
}

/** Crawl breakdown entry */
export interface CrawlBreakdownEntry {
  /** The date */
  date: string
  /** Tool -> type -> count mapping */
  [tool: string]: string | Record<string, number>
}

/** Tools ran per day entry */
export interface ToolsRanPerDayEntry {
  /** The date */
  date: string
  /** Tool -> count mapping */
  [tool: string]: string | number
}

/** Available status keys */
export type StatusKey = 'requestcount' | 'processedperday' | 'recentlycrawled' | 'crawlbreakdown' | 'toolsranperday'

/** Status data union type */
export type StatusData =
  | RequestCountData
  | ProcessedPerDayEntry[]
  | RecentlyCrawledEntry[]
  | CrawlBreakdownEntry[]
  | ToolsRanPerDayEntry[]

/** Status lookup function type */
export type StatusLookupFn = () => Promise<StatusData>

/**
 * Service for retrieving system status information from Application Insights.
 * Provides various metrics about system usage and crawler activity.
 */
export declare class StatusService {
  /** Configuration options */
  protected options: StatusServiceOptions

  /** Logger instance */
  protected logger: Logger

  /** Cache instance */
  protected cache: ICache

  /** Lookup table for status functions */
  protected statusLookup: Record<StatusKey, StatusLookupFn>

  /**
   * Creates a new StatusService instance
   *
   * @param options - Configuration options for Application Insights
   * @param cache - Cache for storing results
   */
  constructor(options: StatusServiceOptions, cache: ICache)

  /**
   * Get status data for a specific key
   *
   * @param key - The status key to retrieve
   * @returns The status data
   * @throws Error if key is not found or if an unexpected error occurs
   */
  get(key: string): Promise<StatusData>

  /**
   * List all available status keys
   *
   * @returns Array of available status keys
   */
  list(): StatusKey[]
}

/**
 * Factory function to create a StatusService instance
 *
 * @param options - Configuration options for Application Insights
 * @param cache - Cache for storing results
 * @returns A new StatusService instance
 */
declare function createStatusService(options: StatusServiceOptions, cache: ICache): StatusService

export default createStatusService
export = createStatusService
