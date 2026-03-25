// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { CacheClass } from 'memory-cache'
import type {
  ContributionInfo,
  CurationDefinitionService,
  CurationHarvestStore,
  CurationListResult,
  CurationPatch,
  Endpoints,
  GitHubCurationOptions,
  GitHubPR,
  ICurationStore
} from '.'
import type Curation from '../../lib/curation'
import type { CurationRevision } from '../../lib/curation'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { GitHubClient } from '../../lib/github'
import type { LicenseMatcher } from '../../lib/licenseMatcher'
import type { Definition } from '../../lib/utils'
import type { ICache } from '../caching'
import type { Logger } from '../logging'

/** User info returned from the GitHub API */
export interface GitHubUserInfo {
  name?: string | null
  email?: string | null
  login?: string | null
}

/** GitHub commit status state values */
export type CommitStatusState = 'error' | 'failure' | 'pending' | 'success'

/**
 * Manages curation patches in a GitHub repository.
 *
 * Reads and writes curation YAML files in a dedicated GitHub repo, creates PRs for new curations,
 * validates contributed curations, and handles multiversion auto-curation.
 */
export declare class GitHubCurationService {
  logger: Logger
  options: GitHubCurationOptions
  store: ICurationStore
  endpoints: Endpoints
  definitionService: CurationDefinitionService
  curationUpdateTime: Date | null
  tempLocation: string | null
  github: GitHubClient
  cache: ICache
  harvestStore: CurationHarvestStore
  licenseMatcher: LicenseMatcher
  smartGit: import('geit')
  treeCache: CacheClass<string, import('geit')>

  constructor(
    options: GitHubCurationOptions,
    store: ICurationStore,
    endpoints: Endpoints,
    definition: CurationDefinitionService,
    cache: ICache,
    harvestStore: CurationHarvestStore,
    licenseMatcher?: LicenseMatcher
  )

  /** Temporary directory options for git operations */
  readonly tmpOptions: { unsafeCleanup: boolean; template: string }

  /**
   * Enumerate all contributions on GitHub and update any that are out of sync in the store.
   *
   * @param client - Authenticated GitHub client
   */
  syncAllContributions(client: GitHubClient): Promise<void>

  /**
   * Persist the updated contribution in the store and handle newly merged contributions.
   *
   * @param pr - The GitHub PR object
   * @param curations - Optional contributed curations for this PR
   */
  updateContribution(pr: GitHubPR, curations?: Curation[] | null): Promise<void>

  /**
   * Validate contributed curations and post commit status / error comments.
   *
   * @param number - The PR number
   * @param sha - The commit SHA to post status against
   * @param curations - The curations to validate
   */
  validateContributions(number: number, sha: string, curations: Curation[]): Promise<void>

  /**
   * Create or update a curation PR after validating all target definitions exist.
   *
   * @param userGithub - The contributor's authenticated GitHub client (may be null)
   * @param serviceGithub - The service's authenticated GitHub client
   * @param info - Contributor / contribution metadata
   * @param patch - The curation patch payload
   * @returns The GitHub API response for the created PR
   */
  addOrUpdate(
    userGithub: GitHubClient | null,
    serviceGithub: GitHubClient,
    info: ContributionInfo,
    patch: CurationPatch
  ): Promise<{ data: { number: number; html_url: string } }>

  /**
   * Handle a merged PR by potentially creating multiversion curations.
   *
   * @param pr - The merged PR
   */
  addByMergedCuration(pr: GitHubPR): Promise<void>

  /**
   * Attempt automatic curation of a newly harvested definition by matching
   * against existing curations for other versions.
   *
   * @param definition - The definition to attempt auto-curation for
   */
  autoCurate(definition: Definition): Promise<void>

  /**
   * Get the curation for the entity at the given coordinates.
   *
   * @param coordinates - The entity coordinates (must include revision)
   * @param curation - Optional PR number, string, or actual curation object
   * @returns The matching curation revision data, or null
   */
  get(
    coordinates: EntityCoordinates,
    curation?: number | string | CurationRevision | null
  ): Promise<CurationRevision | null>

  /**
   * Apply a curation to a definition.
   *
   * @param coordinates - The entity coordinates
   * @param curationSpec - Curation identifier or object
   * @param definition - The definition to apply the curation to
   * @returns The curated definition
   */
  apply(
    coordinates: EntityCoordinates,
    curationSpec: number | string | CurationRevision | null,
    definition: Definition
  ): Promise<Definition>

  /**
   * List curations and contributions matching the given coordinates (cached).
   *
   * @param coordinates - Partial coordinates to search for
   * @returns Curations and contributions, or null
   */
  list(coordinates: EntityCoordinates): Promise<CurationListResult | null>

  /**
   * List curations and contributions for multiple coordinates.
   *
   * @param coordinatesList - Array of coordinates to look up
   * @returns Map of coordinate string → curation list result
   */
  listAll(coordinatesList: EntityCoordinates[]): Promise<Record<string, CurationListResult>>

  /**
   * Get the full URL for a curation PR on GitHub.
   *
   * @param number - The PR number
   * @returns The GitHub PR URL
   */
  getCurationUrl(number: number): string

  /**
   * Get the curations contributed in a specific PR.
   *
   * @param number - The PR number
   * @param sha - The PR head SHA
   * @returns Array of Curation instances
   */
  getContributedCurations(number: number, sha: string): Promise<Curation[]>

  /**
   * Get the coordinates of definitions changed by a PR.
   *
   * @param number - The PR number
   * @returns Array of coordinate strings for changed definitions
   */
  getChangedDefinitions(number: number): Promise<string[]>

  /**
   * Check whether a file path is a curation file (starts with `curations/` and ends with `.yaml`).
   *
   * @param path - The file path to check
   * @returns true if the path is a curation file
   */
  isCurationFile(path: string): boolean

  /**
   * Reprocess merged curations for the given coordinates to find additional
   * versions that can be auto-curated.
   *
   * @param coordinatesList - Array of coordinates to reprocess
   * @returns Results with coordinates, contribution URLs, and any errors
   */
  reprocessMergedCurations(coordinatesList: EntityCoordinates[]): Promise<
    {
      coordinates: string
      contribution?: string
      error?: string
      contributions?: { coordinates: string; contribution?: string }[]
    }[]
  >
}

/**
 * Factory function to create a GitHubCurationService instance.
 *
 * @param options - GitHub repository configuration
 * @param store - Curation store (MemoryStore or MongoCurationStore)
 * @param endpoints - Website endpoint URLs
 * @param definition - Definition service for lookups and invalidation
 * @param cache - Cache for curation lookups
 * @param harvestService - Harvest store for license matching
 * @param licenseMatcher - Optional license matcher (defaults to new LicenseMatcher)
 * @returns A new GitHubCurationService instance
 */
declare function createGitHubCurationService(
  options: GitHubCurationOptions,
  store: ICurationStore,
  endpoints: Endpoints,
  definition: CurationDefinitionService,
  cache: ICache,
  harvestService: CurationHarvestStore,
  licenseMatcher?: LicenseMatcher
): GitHubCurationService

export default createGitHubCurationService
export = createGitHubCurationService
