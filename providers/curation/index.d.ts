// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type Curation from '../../lib/curation'
import type { CurationData, CurationRevision } from '../../lib/curation'
import type { Definition } from '../../lib/utils'

/** Subset of DefinitionService methods used by GitHubCurationService */
export interface CurationDefinitionService {
  getStored(coordinates: EntityCoordinates): Promise<Definition | null>
  invalidate(coordinateList: EntityCoordinates[]): Promise<void[]>
  computeAndStore(coordinates: EntityCoordinates): Promise<Definition>
  list(coordinates: EntityCoordinates): Promise<string[]>
  listAll(coordinatesList: EntityCoordinates[]): Promise<EntityCoordinates[]>
}

/** Subset of HarvestStore methods used by GitHubCurationService */
export interface CurationHarvestStore {
  getAll(coordinates: EntityCoordinates): Promise<Record<string, Record<string, unknown>>>
}

/** Configuration options for the GitHub-backed curation service */
export interface GitHubCurationOptions {
  /** GitHub org or user that owns the curation repo */
  owner: string
  /** Name of the curation repo (e.g. `curated-data`) */
  repo: string
  /** Default branch to read curations from */
  branch: string
  /** GitHub personal-access token */
  token: string
  /** Directory for temporary clones / working copies */
  tempLocation?: string
  /** Whether automatic multiversion curation is enabled */
  multiversionCurationFeatureFlag?: boolean
}

/** Endpoint URLs used by the curation service */
export interface Endpoints {
  /** Base URL of the ClearlyDefined website (e.g. `https://clearlydefined.io`) */
  website: string
}

/** Subset of GitHub PR fields the curation service reads and stores */
export interface GitHubPR {
  number: number
  id: number
  state: string
  title: string
  body: string
  created_at: string
  updated_at: string
  closed_at: string | null
  merged_at: string | null
  merge_commit_sha: string | null
  html_url?: string
  user: { login: string }
  head: { sha: string; repo?: { id: number } }
  base: { sha: string; repo?: { id: number } }
}

/** The PR shape persisted in the contribution store (picked subset of GitHubPR) */
export interface ContributionPR {
  number: number
  id: number
  state: string
  title: string
  body: string
  created_at: string
  updated_at: string
  closed_at: string | null
  merged_at: string | null
  merge_commit_sha: string | null
  user: { login: string }
  head: { sha: string; repo: { id?: number } }
  base: { sha: string; repo: { id?: number } }
}

/** A stored contribution: the PR metadata plus the curation files it touched */
export interface Contribution {
  /** The PR metadata */
  pr: ContributionPR
  /** Curation file contents keyed by file path */
  files: Record<string, CurationData> | ContributionFile[]
}

/** A contribution file entry as stored in MongoDB */
export interface ContributionFile {
  path: string
  coordinates: {
    type?: string
    provider?: string
    namespace?: string
    name?: string
  }
  revisions: { revision: string; data: CurationRevision }[]
}

/** Result of listing curations from the Mongo store */
export interface CurationListResult {
  curations: Record<string, CurationRevision>
  contributions: Contribution[]
}

/** Metadata about the contribution (used when creating a PR) */
export interface ContributionInfo {
  /** Type of contribution (e.g. `other`, `missing`, `incorrect`, `incomplete`, `ambiguous`, `auto`) */
  type: string
  /** One-line summary shown as the PR title */
  summary: string
  /** Longer description of the change */
  details: string
  /** Explanation of why this contribution is being made */
  resolution: string
  /** GitHub login of the contributor */
  login?: string
  /** Display name of the contributor */
  name?: string
  /** Email of the contributor */
  email?: string
}

/** A single patch (one component's worth of curation changes) */
export interface CurationPatchEntry {
  /** Revisionless coordinates for the component */
  coordinates: EntityCoordinates
  /** Curation changes keyed by revision */
  revisions: Record<string, CurationRevision>
}

/** Full payload for creating or updating a curation PR */
export interface CurationPatch {
  /** Metadata about the contribution */
  contributionInfo: ContributionInfo
  /** One or more component patches */
  patches: CurationPatchEntry[]
}

/** Version + reason bundle returned by multiversion matching */
export interface MatchingRevisionAndReason {
  version: string
  matchingProperties: MatchingProperty[]
}

/** A single property that matched between two versions */
export interface MatchingProperty {
  file?: string
  propPath?: string
  value?: unknown
}

/** Options for MongoDB-backed curation store */
export interface MongoCurationStoreOptions {
  /** MongoDB connection string */
  connectionString: string
  /** Database name */
  dbName: string
  /** Collection name */
  collectionName: string
}

/**
 * Common interface for curation stores.
 * Implemented by both MemoryStore (tests) and MongoCurationStore (production).
 */
export interface ICurationStore {
  /** Set up the store (e.g. open connections). */
  initialize(): Promise<void> | void

  /**
   * Replace the stored curations with the given set.
   * Called when a curation PR is merged.
   */
  updateCurations(curations: Curation[]): Promise<void | null> | void

  /**
   * Retrieve the stored contribution for the given PR number.
   * Returns `null` when no contribution is found.
   */
  getContribution(prNumber: number): Promise<Contribution | null> | Contribution | null

  /**
   * Create or update the contribution record for the given PR.
   * If curations are not provided, only the PR metadata is updated.
   */
  updateContribution(pr: ContributionPR, curations?: Curation[] | null): Promise<void> | void

  /**
   * List curations matching the given coordinates.
   * MongoCurationStore returns `CurationListResult`; MemoryStore returns `CurationData[]`.
   */
  list(coordinates: EntityCoordinates): Promise<CurationListResult | null> | CurationData[]
}
