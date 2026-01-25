// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from '../providers/caching'
import type { Logger } from '../providers/logging'
import type { DefinitionService } from './definitionService'

/** Facet entry in a frequency table */
export interface FacetEntry {
  /** The count of items with this value */
  count: number
  /** The value */
  value: string | number
}

/** Statistics result for a component type */
export interface TypeStats {
  /** Total count of definitions */
  totalCount: number
  /** Median described score */
  describedScoreMedian: number
  /** Median licensed score */
  licensedScoreMedian: number
  /** Breakdown of declared licenses */
  declaredLicenseBreakdown: FacetEntry[]
}

/** Available stat keys */
export type StatKey =
  | 'total'
  | 'conda'
  | 'condasrc'
  | 'crate'
  | 'gem'
  | 'git'
  | 'maven'
  | 'npm'
  | 'nuget'
  | 'pod'
  | 'composer'
  | 'pypi'
  | 'deb'
  | 'debsrc'

/** Search service interface for stats queries */
export interface StatsSearchService {
  /**
   * Query the search index with faceting
   *
   * @param query - The query parameters
   * @returns The search response with facets
   */
  query(query: StatsQuery): Promise<StatsSearchResponse>
}

/** Query parameters for stats */
export interface StatsQuery {
  /** Whether to include count */
  count: boolean
  /** Filter expression */
  filter: string | null
  /** Facets to compute */
  facets: string[]
  /** Number of results to return */
  top: number
}

/** Search response with facets */
export interface StatsSearchResponse {
  /** Total count of matching items */
  '@odata.count': number
  /** Facet results */
  '@search.facets': {
    /** Described score facet */
    describedScore: FacetEntry[]
    /** Licensed score facet */
    licensedScore: FacetEntry[]
    /** Declared license facet */
    declaredLicense: FacetEntry[]
  }
}

/**
 * Service for computing and caching statistics about definitions.
 * Provides aggregate metrics broken down by component type.
 */
export declare class StatsService {
  /** Definition service instance */
  protected definitionService: DefinitionService

  /** Search service instance */
  protected searchService: StatsSearchService

  /** Logger instance */
  protected logger: Logger

  /** Cache instance */
  protected cache: ICache

  /** Lookup table for stat functions */
  protected statLookup: Record<StatKey, () => Promise<TypeStats>>

  /**
   * Creates a new StatsService instance
   *
   * @param definitionService - The definition service
   * @param searchService - The search service for querying
   * @param cache - Cache for storing results
   */
  constructor(definitionService: DefinitionService, searchService: StatsSearchService, cache: ICache)

  /**
   * Get statistics for a specific key
   *
   * @param stat - The stat key to retrieve
   * @returns The statistics data
   * @throws Error if key is not found or if an unexpected error occurs
   */
  get(stat: string): Promise<TypeStats>

  /**
   * List all available stat keys
   *
   * @returns Array of available stat keys
   */
  list(): StatKey[]
}

/**
 * Factory function to create a StatsService instance
 *
 * @param definitionService - The definition service
 * @param searchService - The search service for querying
 * @param cache - Cache for storing results
 * @returns A new StatsService instance
 */
declare function createStatsService(
  definitionService: DefinitionService,
  searchService: StatsSearchService,
  cache: ICache
): StatsService

export default createStatsService
export = createStatsService
