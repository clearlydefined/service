// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Request } from 'express'
import EntityCoordinates, { EntityCoordinatesSpec } from './entityCoordinates'
import ResultCoordinates from './resultCoordinates'

/** Express request with route params for entity coordinates */
export interface EntityCoordinatesRequest extends Request {
  params: {
    type?: string
    provider?: string
    namespace?: string
    name?: string
    revision?: string
    tool?: string
    toolVersion?: string
    extra1?: string
    extra2?: string
    extra3?: string
  }
}

/** Source location specification for a component */
export interface SourceLocationSpec {
  type?: string
  provider?: string
  namespace?: string
  name?: string
  revision?: string
  url?: string
}

/** File entry in a definition */
export interface FileEntry {
  path: string
  license?: string
  attributions?: string[]
  facets?: string[]
  hashes?: Record<string, string>
  natures?: string[]
  token?: string
}

/** Described section of a definition */
export interface DescribedSection {
  releaseDate?: string
  projectWebsite?: string
  urls?: Record<string, string>
  sourceLocation?: SourceLocationSpec
  facets?: Record<string, string[]>
  hashes?: Record<string, string>
  files?: number
  tools?: string[]
  toolScore?: ScoreSection
  score?: ScoreSection
}

/** Licensed section of a definition */
export interface LicensedSection {
  declared?: string
  toolScore?: LicensedScoreSection
  score?: LicensedScoreSection
  facets?: Record<string, FacetInfo>
}

/** Score breakdown for described section */
export interface ScoreSection {
  total: number
  date: number
  source: number
}

/** Score breakdown for licensed section */
export interface LicensedScoreSection {
  total: number
  declared: number
  discovered: number
  consistency: number
  spdx: number
  texts: number
}

/** Facet information for a set of files */
export interface FacetInfo {
  files: number
  attribution?: {
    parties?: string[]
    unknown: number
  }
  discovered?: {
    expressions?: string[]
    unknown: number
  }
}

/** Full definition object */
export interface Definition {
  coordinates?: EntityCoordinates
  described?: DescribedSection
  licensed?: LicensedSection
  files?: FileEntry[]
  scores?: {
    effective: number
    tool: number
  }
  _meta?: {
    schemaVersion: string
    updated: string
  }
}

/** Package info for debsrc license locations */
export interface PackageInfo {
  type?: string
  name?: string
  version?: string
}

/** Parsed URN components */
export interface ParsedUrn {
  scheme?: string
  type?: string
  provider?: string
  namespace?: string
  name?: string
  revToken?: string
  revision?: string
  toolToken?: string
  tool?: string
  toolRevision?: string
}

/**
 * Creates ResultCoordinates from an Express request with tool parameters
 * @param request - Express request with entity and tool params
 * @returns ResultCoordinates instance
 */
export function toResultCoordinatesFromRequest(request: EntityCoordinatesRequest): Promise<ResultCoordinates>

/**
 * Creates EntityCoordinates from an Express request
 * @param request - Express request with entity params
 * @returns EntityCoordinates instance
 */
export function toEntityCoordinatesFromRequest(request: EntityCoordinatesRequest): Promise<EntityCoordinates>

/**
 * Creates EntityCoordinates from command-line style arguments
 * @param args - Object with type, provider, namespace, name, revision keys
 * @returns EntityCoordinates instance
 */
export function toEntityCoordinatesFromArgs(args: Record<string, string>): EntityCoordinates

/**
 * Normalizes EntityCoordinates using coordinate mappers
 * @param spec - Entity coordinates specification
 * @returns Normalized EntityCoordinates
 */
export function toNormalizedEntityCoordinates(spec: EntityCoordinatesSpec): Promise<EntityCoordinates>

/**
 * Gets the latest semantic version from an array of versions
 * @param versions - Array of version strings or a single version
 * @returns The latest non-prerelease version, or null if none found
 */
export function getLatestVersion(versions: string | string[]): string | null

/**
 * Extracts and validates a date from various date/time formats
 * @param dateAndTime - Date string in various formats (ISO, RFC2822, HTTP, SQL, etc.)
 * @returns ISO date string (yyyy-MM-dd) or null if invalid
 */
export function extractDate(dateAndTime: string | null | undefined): string | null

/**
 * Compares two ISO date strings
 * @param dateA - First date string
 * @param dateB - Second date string
 * @returns Negative if dateA < dateB, positive if dateA > dateB, 0 if equal
 */
export function compareDates(dateA: string | null | undefined, dateB: string | null | undefined): number

/**
 * Sets a value at the given path if the value is truthy and not an empty array
 * @param target - Object to set the value on
 * @param path - Lodash-style path string
 * @param value - Value to set
 * @returns true if value was set, false otherwise
 */
export function setIfValue(target: object, path: string, value: unknown): boolean

/**
 * Converts a Set to a sorted array, filtering out falsy values
 * @param values - Set of values
 * @returns Sorted array or null if empty
 */
export function setToArray<T>(values: Set<T>): T[] | null

/**
 * Adds array elements to a Set, optionally extracting values
 * @param array - Array of values to add
 * @param set - Set to add values to
 * @param valueExtractor - Optional function to extract value from each element
 * @returns The modified Set
 */
export function addArrayToSet<T, V>(
  array: T[] | null | undefined,
  set: Set<V>,
  valueExtractor?: (value: T) => V
): Set<V>

/**
 * Extracts an SPDX license identifier from a license URL
 * @param licenseUrl - URL pointing to a license
 * @returns SPDX license identifier or null
 */
export function extractLicenseFromLicenseUrl(licenseUrl: string | null | undefined): string | null

/**
 * Gets the license file location prefixes for a given coordinate type
 * @param coordinates - Entity coordinates
 * @param packages - Optional package info for debsrc
 * @returns Array of path prefixes where license files may be found
 */
export function getLicenseLocations(coordinates: EntityCoordinates, packages?: PackageInfo[]): string[] | undefined

/**
 * Joins a set of license expressions with AND
 * @param expressions - Set of SPDX expressions
 * @returns Normalized combined expression or null
 */
export function joinExpressions(expressions: Set<string> | null | undefined): string | null

/**
 * Normalizes a raw license expression to SPDX format
 * @param rawLicenseExpression - Raw license expression string
 * @param logger - Logger instance for warnings
 * @param licenseRefLookup - Optional function to resolve license references
 * @returns Normalized SPDX expression or null
 */
export function normalizeLicenseExpression(
  rawLicenseExpression: string | null | undefined,
  logger: { info: (message: string) => void },
  licenseRefLookup?: (token: string) => string | undefined
): string | null

/**
 * Merges a proposed definition onto a base definition
 * @param base - Base definition to merge onto
 * @param proposed - Proposed changes to merge
 * @param override - If true, proposed values override rather than merge
 * @returns The proposed definition if base is null/undefined, otherwise void (base is modified in place)
 */
export function mergeDefinitions(
  base: Definition | null | undefined,
  proposed: Partial<Definition> | null | undefined,
  override?: boolean
): Partial<Definition> | null | undefined | void

/**
 * Builds a source URL for the given coordinates
 * @param spec - Entity coordinates specification
 * @returns Source URL or null if provider not supported
 */
export function buildSourceUrl(spec: EntityCoordinatesSpec): string | null

/**
 * Decodes percent-encoded slashes in a namespace
 * @param namespace - Namespace string with possible %2f encodings
 * @returns Decoded namespace string
 */
export function deCodeSlashes(namespace: string): string

/**
 * Updates a source location spec to the current format
 * @param spec - Source location to update in place
 */
export function updateSourceLocation(spec: SourceLocationSpec): void

/**
 * Determines if a file path represents a license file
 * @param filePath - Path to check
 * @param coordinates - Optional coordinates for type-specific checking
 * @param packages - Optional packages for debsrc type
 * @returns true if the path appears to be a license file
 */
export function isLicenseFile(
  filePath: string | null | undefined,
  coordinates?: EntityCoordinates,
  packages?: PackageInfo[]
): boolean

/**
 * Simplifies and deduplicates attribution strings
 * @param entries - Array of attribution strings
 * @returns Simplified array or null if empty
 */
export function simplifyAttributions(entries: string[] | null | undefined): string[] | null

/**
 * Checks if an identifier represents a declared license (not NOASSERTION or NONE)
 * @param identifier - SPDX license identifier
 * @returns true if it's a valid declared license
 */
export function isDeclaredLicense(identifier: string | null | undefined): boolean

/**
 * Parses a URN string into its component parts
 * @param urn - URN string to parse
 * @returns Object with parsed URN components
 */
export function parseUrn(urn: string | null | undefined): ParsedUrn

/**
 * Parses namespace/name/revision from request params including extras
 * @param request - Express request with params
 * @returns Combined path string
 */
export function parseNamespaceNameRevision(request: EntityCoordinatesRequest): string
