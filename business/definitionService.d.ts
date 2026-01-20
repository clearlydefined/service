// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../lib/entityCoordinates'
import type { ICache } from '../providers/caching'
import type { Logger } from '../providers/logging'

/** Score breakdown for the described dimension */
export interface DescribedScore {
  /** Total score for the described dimension */
  total: number
  /** Score contribution from release date */
  date: number
  /** Score contribution from source location */
  source: number
}

/** Score breakdown for the licensed dimension */
export interface LicensedScore {
  /** Total score for the licensed dimension */
  total: number
  /** Score contribution from declared license */
  declared: number
  /** Score contribution from discovered licenses */
  discovered: number
  /** Score contribution from license consistency */
  consistency: number
  /** Score contribution from SPDX compliance */
  spdx: number
  /** Score contribution from license texts */
  texts: number
}

/** Combined scores for a definition */
export interface DefinitionScores {
  /** Effective combined score */
  effective: number
  /** Tool-only score (before curation) */
  tool: number
}

/** Source location information */
export interface SourceLocation {
  /** Type of the source (e.g., 'git') */
  type?: string
  /** Provider of the source (e.g., 'github') */
  provider?: string
  /** Namespace of the source */
  namespace?: string
  /** Name of the source repository */
  name?: string
  /** Revision/commit of the source */
  revision?: string
  /** URL to the source */
  url?: string
}

/** Described section of a definition */
export interface DefinitionDescribed {
  /** Release date of the component */
  releaseDate?: string
  /** Source code location */
  sourceLocation?: SourceLocation
  /** List of tools that contributed to the definition */
  tools?: string[]
  /** Tool-derived score */
  toolScore?: DescribedScore
  /** Final score after curation */
  score?: DescribedScore
  /** Project website URL */
  projectWebsite?: string
  /** Facet definitions */
  facets?: Record<string, string[]>
}

/** Attribution information for a facet */
export interface FacetAttribution {
  /** Number of files with unknown attribution */
  unknown: number
  /** List of attribution parties */
  parties?: string[]
}

/** Discovered license information for a facet */
export interface FacetDiscovered {
  /** Number of files with unknown license */
  unknown: number
  /** List of discovered license expressions */
  expressions?: string[]
}

/** Facet summary information */
export interface FacetInfo {
  /** Attribution information */
  attribution: FacetAttribution
  /** Discovered license information */
  discovered: FacetDiscovered
  /** Number of files in the facet */
  files: number
}

/** Licensed section of a definition */
export interface DefinitionLicensed {
  /** Declared license expression */
  declared?: string
  /** Tool-derived score */
  toolScore?: LicensedScore
  /** Final score after curation */
  score?: LicensedScore
  /** Facet information */
  facets?: Record<string, FacetInfo>
}

/** File entry in a definition */
export interface DefinitionFile {
  /** Path to the file */
  path: string
  /** License expression for the file */
  license?: string
  /** Attribution statements */
  attributions?: string[]
  /** Hashes for the file */
  hashes?: Record<string, string>
  /** Token for retrieving file content */
  token?: string
  /** Nature of the file (e.g., 'license') */
  natures?: string[]
  /** Facets the file belongs to */
  facets?: string[]
}

/** Metadata section of a definition */
export interface DefinitionMeta {
  /** Schema version of the definition */
  schemaVersion: string
  /** Last update timestamp */
  updated: string
}

/** Complete definition object */
export interface Definition {
  /** Coordinates identifying the component */
  coordinates: EntityCoordinates
  /** Described information */
  described?: DefinitionDescribed
  /** Licensed information */
  licensed?: DefinitionLicensed
  /** File list */
  files?: DefinitionFile[]
  /** Scores */
  scores?: DefinitionScores
  /** Metadata */
  _meta?: DefinitionMeta
}

/** Query parameters for finding definitions */
export interface DefinitionFindQuery {
  /** Filter by component type */
  type?: string
  /** Filter by provider */
  provider?: string
  /** Filter by namespace */
  namespace?: string
  /** Filter by name */
  name?: string
  /** Filter by declared license */
  license?: string
  /** Filter by release date (after) */
  releasedAfter?: string
  /** Filter by release date (before) */
  releasedBefore?: string
  /** Filter by minimum licensed score */
  minLicensedScore?: number
  /** Filter by maximum licensed score */
  maxLicensedScore?: number
  /** Filter by minimum described score */
  minDescribedScore?: number
  /** Filter by maximum described score */
  maxDescribedScore?: number
  /** Continuation token for pagination */
  continuationToken?: string
}

/** Result of a find operation */
export interface DefinitionFindResult {
  /** Array of matching definitions */
  data: Definition[]
  /** Continuation token for next page */
  continuationToken?: string
}

/** Harvest store interface */
export interface HarvestStore {
  /** List harvested coordinates */
  list(coordinates: EntityCoordinates): Promise<string[]>
  /** Get all latest harvest data for coordinates */
  getAllLatest(coordinates: EntityCoordinates): Promise<Record<string, Record<string, any>>>
}

/** Harvest service interface */
export interface HarvestService {
  /** Trigger a harvest for coordinates */
  harvest(request: { tool: string; coordinates: EntityCoordinates }, rebuild?: boolean): Promise<void>
  /** Mark harvesting as done for coordinates */
  done(coordinates: EntityCoordinates): Promise<void>
}

/** Summary service interface */
export interface SummaryService {
  /** Summarize all tool data for coordinates */
  summarizeAll(
    coordinates: EntityCoordinates,
    data: Record<string, Record<string, any>>
  ): Record<string, Record<string, any>>
}

/** Aggregation service interface */
export interface AggregationService {
  /** Process summarized data into a single definition */
  process(
    summarized: Record<string, Record<string, any>>,
    coordinates: EntityCoordinates
  ): Promise<Partial<Definition> | null>
}

/** Curation service interface */
export interface CurationService {
  /** Get a curation by PR number */
  get(coordinates: EntityCoordinates, pr: number | string): Promise<any>
  /** List curations for coordinates */
  list(coordinates: EntityCoordinates): Promise<EntityCoordinates[]>
  /** Apply a curation to a definition */
  apply(coordinates: EntityCoordinates, curationSpec: any, definition: Partial<Definition>): Promise<Definition>
  /** Automatically create curations for a definition */
  autoCurate(definition: Definition): Promise<void>
}

/** Definition store interface */
export interface DefinitionStore {
  /** Get a definition by coordinates */
  get(coordinates: EntityCoordinates): Promise<Definition | null>
  /** Store a definition */
  store(definition: Definition): Promise<void>
  /** Delete a definition */
  delete(coordinates: EntityCoordinates): Promise<void>
  /** List definitions matching coordinates */
  list(coordinates: EntityCoordinates): Promise<string[]>
  /** Find definitions matching a query */
  find(query: DefinitionFindQuery, continuationToken?: string): Promise<DefinitionFindResult>
}

/** Search service interface */
export interface SearchService {
  /** Suggest coordinates matching a pattern */
  suggestCoordinates(pattern: string): Promise<string[]>
  /** Store a definition in the search index */
  store?(definition: Definition): Promise<void>
}

/** Upgrade handler interface */
export interface UpgradeHandler {
  /** Current schema version */
  currentSchema?: string
  /** Validate and potentially upgrade a definition */
  validate(definition: Definition | null): Promise<Definition | null>
}

/**
 * Service for managing component definitions.
 * Handles computation, caching, storage, and retrieval of definitions.
 */
export declare class DefinitionService {
  /** Harvest store instance */
  protected harvestStore: HarvestStore
  /** Harvest service instance */
  protected harvestService: HarvestService
  /** Summary service instance */
  protected summaryService: SummaryService
  /** Aggregation service instance */
  protected aggregationService: AggregationService
  /** Curation service instance */
  protected curationService: CurationService
  /** Definition store instance */
  protected definitionStore: DefinitionStore
  /** Search service instance */
  protected search: SearchService
  /** Cache instance */
  protected cache: ICache
  /** Upgrade handler instance */
  protected upgradeHandler: UpgradeHandler
  /** Logger instance */
  protected logger: Logger

  /**
   * Creates a new DefinitionService instance
   *
   * @param harvestStore - Store for harvest data
   * @param harvestService - Service for triggering harvests
   * @param summary - Service for summarizing tool output
   * @param aggregator - Service for aggregating summaries
   * @param curation - Service for managing curations
   * @param store - Store for definitions
   * @param search - Service for searching definitions
   * @param cache - Cache for definitions
   * @param upgradeHandler - Handler for schema upgrades
   */
  constructor(
    harvestStore: HarvestStore,
    harvestService: HarvestService,
    summary: SummaryService,
    aggregator: AggregationService,
    curation: CurationService,
    store: DefinitionStore,
    search: SearchService,
    cache: ICache,
    upgradeHandler: UpgradeHandler
  )

  /** Get the current schema version */
  readonly currentSchema: string

  /**
   * Get the final representation of the specified definition and optionally apply the indicated curation.
   *
   * @param coordinates - The entity for which we are looking for a definition
   * @param pr - A PR number for a proposed curation (optional)
   * @param force - Whether to force re-computation of the requested definition
   * @param expand - Hints for parts to include/exclude (e.g., "-files")
   * @returns The fully rendered definition
   */
  get(
    coordinates: EntityCoordinates,
    pr?: number | string | null,
    force?: boolean,
    expand?: string | null
  ): Promise<Definition | undefined>

  /**
   * Get directly from cache or store without any side effects like compute
   *
   * @param coordinates - The coordinates to look up
   * @returns The definition in store
   */
  getStored(coordinates: EntityCoordinates): Promise<Definition | null>

  /**
   * Get all of the definition entries available for the given coordinates.
   *
   * @param coordinatesList - An array of coordinate paths to list
   * @param force - Whether to force re-computation of the requested definitions
   * @param expand - Hints for parts to include/exclude
   * @returns A map of coordinates to definitions
   */
  getAll(
    coordinatesList: EntityCoordinates[],
    force?: boolean,
    expand?: string | null
  ): Promise<Record<string, Definition>>

  /**
   * Get a list of coordinates for all known definitions that match the given coordinates
   *
   * @param coordinates - The coordinates to query
   * @param recompute - Whether to recompute the list
   * @returns The list of all coordinates for all discovered definitions
   */
  list(coordinates: EntityCoordinates, recompute?: boolean): Promise<string[]>

  /**
   * Get a list of all the definitions that exist in the store matching the given coordinates
   *
   * @param coordinatesList - Array of coordinates to check
   * @returns A list of all components that have definitions
   */
  listAll(coordinatesList: EntityCoordinates[]): Promise<EntityCoordinates[]>

  /**
   * Get the definitions that exist in the store matching the given query
   *
   * @param query - Query parameters
   * @returns The data and continuationToken if there are more results
   */
  find(query: DefinitionFindQuery): Promise<DefinitionFindResult>

  /**
   * Invalidate the definition for the identified component.
   * This flushes any caches and pre-computed results.
   *
   * @param coordinates - Individual or array of coordinates to invalidate
   */
  invalidate(coordinates: EntityCoordinates | EntityCoordinates[]): Promise<void[]>

  /**
   * Compute and store a definition, then trigger auto-curation
   *
   * @param coordinates - The coordinates to compute
   * @returns The computed definition
   */
  computeStoreAndCurate(coordinates: EntityCoordinates): Promise<Definition>

  /**
   * Compute and store a definition
   *
   * @param coordinates - The coordinates to compute
   * @returns The computed definition
   */
  computeAndStore(coordinates: EntityCoordinates): Promise<Definition>

  /**
   * Compute and store a definition if the tool result is new
   *
   * @param coordinates - The coordinates to compute
   * @param tool - The tool name
   * @param toolRevision - The tool revision
   * @returns The computed definition or undefined if skipped
   */
  computeAndStoreIfNecessary(
    coordinates: EntityCoordinates,
    tool: string,
    toolRevision: string
  ): Promise<Definition | undefined>

  /**
   * Compute the final representation of the specified definition
   *
   * @param coordinates - The entity for which we are computing
   * @param curationSpec - Optional curation to apply
   * @returns The fully rendered definition
   */
  compute(coordinates: EntityCoordinates, curationSpec?: any): Promise<Definition>

  /**
   * Suggest a set of definition coordinates that match the given pattern
   *
   * @param pattern - A pattern to look for in the coordinates
   * @returns The list of suggested coordinates found
   */
  suggestCoordinates(pattern: string): Promise<string[]>

  /**
   * Reload definitions into the search store
   *
   * @param mode - 'definitions' to recompute, 'index' to just re-index
   * @param coordinatesList - Optional list of coordinates to reload
   */
  reload(mode: 'definitions' | 'index', coordinatesList?: string[] | null): Promise<(void | null)[]>

  /**
   * Check if a file is in the core facet
   *
   * @param file - The file to check
   * @returns True if the file is in the core facet
   */
  static _isInCoreFacet(file: DefinitionFile): boolean

  /**
   * Check if a file is a license file
   *
   * @param file - The file to check
   * @returns True if the file is a license file
   */
  static _isLicenseFile(file: DefinitionFile): boolean
}

/**
 * Factory function to create a DefinitionService instance
 *
 * @param harvestStore - Store for harvest data
 * @param harvestService - Service for triggering harvests
 * @param summary - Service for summarizing tool output
 * @param aggregator - Service for aggregating summaries
 * @param curation - Service for managing curations
 * @param store - Store for definitions
 * @param search - Service for searching definitions
 * @param cache - Cache for definitions
 * @param versionHandler - Handler for schema upgrades
 * @returns A new DefinitionService instance
 */
declare function createDefinitionService(
  harvestStore: HarvestStore,
  harvestService: HarvestService,
  summary: SummaryService,
  aggregator: AggregationService,
  curation: CurationService,
  store: DefinitionStore,
  search: SearchService,
  cache: ICache,
  versionHandler: UpgradeHandler
): DefinitionService

export default createDefinitionService
export = createDefinitionService
