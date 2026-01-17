// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates'
import type { Definition, SourceLocationSpec, FileEntry } from '../../lib/utils'
import type { SummarizerOptions } from './index'

/** Registry entry for Debian packages */
export interface DebianRegistryEntry {
  Architecture?: string
  Path: string
  [key: string]: unknown
}

/** Registry data for Conda packages */
export interface CondaRegistryData {
  downloadUrl?: string
  channelData?: {
    home?: string
    source_url?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Registry data for NPM packages */
export interface NpmRegistryData {
  releaseDate?: string
  manifest?: NpmManifest
  [key: string]: unknown
}

/** NPM package manifest */
export interface NpmManifest {
  license?: string | string[] | { type: string } | { type: string[] }
  licenses?: string | string[] | { type: string } | { type: string[] }
  homepage?: string | string[]
  bugs?: string | { url?: string; email?: string }
  [key: string]: unknown
}

/** Registry data for Composer packages */
export interface ComposerRegistryData {
  releaseDate?: string
  manifest?: ComposerManifest
  [key: string]: unknown
}

/** Composer package manifest */
export interface ComposerManifest {
  license?: string | string[] | { type: string } | { type: string[] }
  homepage?: string
  version?: string
  dist?: { url?: string }
  [key: string]: unknown
}

/** Registry data for Crate packages */
export interface CrateRegistryData {
  created_at?: string
  license?: string
  [key: string]: unknown
}

/** Registry data for Gem packages */
export interface GemRegistryData {
  license?: string
  licenses?: string[]
  [key: string]: unknown
}

/** Registry data for Pod packages */
export interface PodRegistryData {
  homepage?: string
  license?: string | { type: string }
  source?: { http?: string; git?: string }
  [key: string]: unknown
}

/** Registry data for PyPI packages */
export interface PyPiRegistryData {
  releases?: Record<string, { filename?: string; url?: string }[]>
  [key: string]: unknown
}

/** Registry data for Go packages */
export interface GoRegistryData {
  licenses?: string[]
  [key: string]: unknown
}

/** Maven license information */
export interface MavenLicenseInfo {
  name?: string
  url?: string
  license?: MavenLicenseInfo | MavenLicenseInfo[]
  [key: string]: unknown
}

/** Maven manifest summary */
export interface MavenManifestSummary {
  licenses?: MavenLicenseInfo[]
  project?: { licenses?: MavenLicenseInfo[] }
  [key: string]: unknown
}

/** NuGet package manifest */
export interface NuGetManifest {
  licenseExpression?: string
  licenseUrl?: string
  packageEntries?: { fullName: string }[]
  [key: string]: unknown
}

/** Harvested data structure for ClearlyDefined tool */
export interface ClearlyDefinedHarvestedData {
  facets?: Record<string, string[]>
  sourceInfo?: SourceLocationSpec
  summaryInfo?: {
    hashes?: Record<string, string>
    count?: number
  }
  files?: { path: string; hashes?: Record<string, string> }[]
  attachments?: { path: string; token?: string }[]
  interestingFiles?: { path: string; license?: string; natures?: string[] }[]
  releaseDate?: string
  registryData?:
    | NpmRegistryData
    | ComposerRegistryData
    | CrateRegistryData
    | GemRegistryData
    | PodRegistryData
    | PyPiRegistryData
    | GoRegistryData
    | DebianRegistryEntry[]
  manifest?: NuGetManifest | { summary?: MavenManifestSummary; homepage?: string; licenseExpression?: string }
  declaredLicenses?: string | string[]
  [key: string]: unknown
}

/** URL information for download and registry */
export interface ComponentUrls {
  download: string
  registry: string
  version?: string
}

/** Result of summarization (partial Definition) */
export interface SummaryResult {
  described?: {
    releaseDate?: string
    projectWebsite?: string
    issueTracker?: string
    hashes?: Record<string, string>
    files?: number
    facets?: Record<string, string[]>
    sourceLocation?: SourceLocationSpec
    urls?: {
      registry?: string
      version?: string
      download?: string
    }
  }
  licensed?: {
    declared?: string
  }
  files?: FileEntry[]
}

/**
 * ClearlyDefined summarizer class that processes harvested data from the ClearlyDefined tool.
 * Handles summarization for multiple package types including npm, maven, nuget, gem, etc.
 */
export declare class Summarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /**
   * Creates a new ClearlyDescribedSummarizer instance
   *
   * @param options - Configuration options for the summarizer
   */
  constructor(options: SummarizerOptions)

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param coordinates - The entity for which we are summarizing
   * @param data - The set of raw tool outputs related to the identified entity
   * @returns A summary of the given raw information
   */
  summarize(coordinates: EntityCoordinates, data: ClearlyDefinedHarvestedData): SummaryResult

  /**
   * Adds summary info (hashes and file count) to the result
   *
   * @param result - The result object to modify
   * @param data - The harvested data
   */
  addSummaryInfo(result: SummaryResult, data: ClearlyDefinedHarvestedData): void

  /**
   * Adds facet information to the result
   *
   * @param result - The result object to modify
   * @param data - The harvested data
   */
  addFacetInfo(result: SummaryResult, data: ClearlyDefinedHarvestedData): void

  /**
   * Adds source location to the result
   *
   * @param result - The result object to modify
   * @param data - The harvested data
   */
  addSourceLocation(result: SummaryResult, data: ClearlyDefinedHarvestedData): void

  /**
   * Adds file information to the result
   *
   * @param result - The result object to modify
   * @param data - The harvested data
   */
  addFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData): void

  /**
   * Adds attached file information (tokens) to the result
   *
   * @param result - The result object to modify
   * @param data - The harvested data
   * @param coordinates - The entity coordinates
   */
  addAttachedFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates): void

  /**
   * Adds interesting files to the result (deprecated - use attachments)
   *
   * @param result - The result object to modify
   * @param data - The harvested data
   * @param coordinates - The entity coordinates
   * @deprecated In favor of attachments
   */
  addInterestingFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates): void

  /**
   * Adds license from files to the result (deprecated - use attachments)
   *
   * @param result - The result object to modify
   * @param data - The harvested data
   * @param coordinates - The entity coordinates
   * @deprecated In favor of attachments
   */
  addLicenseFromFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates): void

  /**
   * Gets Maven registry and download URLs for the given coordinates
   *
   * @param coordinates - The entity coordinates
   * @returns Object containing download and registry URLs
   */
  getMavenUrls(coordinates: EntityCoordinates): ComponentUrls

  /**
   * Extracts declared license from Maven manifest data
   *
   * @param data - The harvested data
   * @returns Array of license identifiers or undefined
   */
  getDeclaredLicenseMaven(data: ClearlyDefinedHarvestedData): string[] | undefined

  /**
   * Gets Git registry, download, and version URLs for the given coordinates
   *
   * @param coordinates - The entity coordinates
   * @returns Object containing download, registry, and version URLs
   */
  getGitUrls(coordinates: EntityCoordinates): ComponentUrls

  /**
   * Gets the Debian registry URL from registry data
   *
   * @param registryData - The registry data entries
   * @returns Registry URL or null
   */
  getDebianRegistryUrl(registryData: DebianRegistryEntry[]): string | null

  /**
   * Parses license expression from manifest, handling various formats
   *
   * @param manifest - The package manifest
   * @param packageType - The type of package ('npm', 'composer', etc.)
   * @returns Parsed license expression or null
   */
  parseLicenseExpression(manifest: NpmManifest | ComposerManifest, packageType: string): string | null
}

/**
 * Factory function that creates a ClearlyDescribedSummarizer instance
 *
 * @param options - Configuration options for the summarizer
 * @returns A new ClearlyDescribedSummarizer instance
 */
declare function clearlydefinedSummarizerFactory(options?: SummarizerOptions): Summarizer

export = clearlydefinedSummarizerFactory
