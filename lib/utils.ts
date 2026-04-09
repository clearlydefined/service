// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request } from 'express'
import type { EntityCoordinatesSpec } from './entityCoordinates.ts'

import he from 'he'
import lodash from 'lodash'
import { DateTime } from 'luxon'
import semver from 'semver'
import EntityCoordinates from './entityCoordinates.ts'
import ResultCoordinates from './resultCoordinates.ts'

const { set, unset, union, sortBy, trim, uniqBy } = lodash

import SPDX from '@clearlydefined/spdx'
import extend from 'extend'
import coordinatesMapperFactory from './coordinatesMapper.ts'
import scancodeMap from './scancodeMap.ts'

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

const coordinatesMapper = coordinatesMapperFactory()

/**
 * Creates ResultCoordinates from an Express request with tool parameters
 */
async function toResultCoordinatesFromRequest(request: EntityCoordinatesRequest): Promise<ResultCoordinates> {
  const coordinates = await toNormalizedEntityCoordinates(request.params)
  return new ResultCoordinates(
    coordinates.type,
    coordinates.provider,
    coordinates.namespace,
    coordinates.name,
    coordinates.revision,
    request.params.tool,
    request.params.toolVersion
  )
}

/**
 * Creates EntityCoordinates from an Express request
 */
async function toEntityCoordinatesFromRequest(request: EntityCoordinatesRequest): Promise<EntityCoordinates> {
  const coordinates = new EntityCoordinates(
    request.params.type,
    request.params.provider,
    request.params.namespace === '-' ? null : reEncodeSlashes(request.params.namespace!),
    request.params.name,
    request.params.revision
  )
  return await toNormalizedEntityCoordinates(coordinates)
}

/**
 * Normalizes EntityCoordinates using coordinate mappers
 */
async function toNormalizedEntityCoordinates(spec: EntityCoordinatesSpec): Promise<EntityCoordinates> {
  const coordinates = EntityCoordinates.fromObject(spec)!
  return await coordinatesMapper.map(coordinates)
}

/**
 * Creates EntityCoordinates from command-line style arguments
 */
function toEntityCoordinatesFromArgs(args: Record<string, string>): EntityCoordinates {
  return new EntityCoordinates(
    args['type'],
    args['provider'],
    args['namespace'] === '-' ? null : reEncodeSlashes(args['namespace']!),
    args['name'],
    args['revision']
  )
}

// When someone requests a component with a slash in the namespace
// They encode that slash as %2f
// For example: https://clearlydefined.io/definitions/go/golang/rsc.io%2fquote/v3/v3.1.0
// When that request is received by the ClearlyDefined service, however, %2f is
// automatically decoded back to a /
// In order to make namespaces with slashes in them work (especially with components types like go (where characters like '.' are also allowed))
// We need to re-encode them before sending the request to the Crawler
/**
 * Re-encodes slashes in a namespace
 */
function reEncodeSlashes(namespace: string): string {
  return `${namespace.replace(/\//g, '%2f')}`
}

/**
 * Parses namespace/name/revision from request params including extras
 */
function parseNamespaceNameRevision(request: EntityCoordinatesRequest): string {
  let namespaceNameRevision = `${request.params.namespace}/${request.params.name}/${request.params.revision}`

  if (request.params.extra1) {
    namespaceNameRevision += `/${request.params.extra1}`
  }

  if (request.params.extra2) {
    namespaceNameRevision += `/${request.params.extra2}`
  }

  if (request.params.extra3) {
    namespaceNameRevision += `/${request.params.extra3}`
  }

  return namespaceNameRevision
}

/**
 * Gets the latest semantic version from an array of versions
 */
function getLatestVersion(versions: string | string[]): string | null {
  if (!Array.isArray(versions)) {
    return versions
  }
  if (versions.length === 0) {
    return null
  }
  if (versions.length === 1) {
    return versions[0]!
  }
  return versions.reduce(
    (max: string, current: string): string => {
      const normalizedCurrent = _normalizeVersion(current)
      if (!normalizedCurrent || semver.prerelease(normalizedCurrent) !== null) {
        return max
      }
      const normalizedMax = _normalizeVersion(max)
      if (!normalizedMax) {
        return normalizedCurrent
      }
      return semver.gt(normalizedCurrent, normalizedMax) ? current : max
    },
    versions[0]!
  )
}

/**
 * Simplifies and deduplicates attribution strings
 */
function simplifyAttributions(entries: string[] | null | undefined): string[] | null {
  if (!entries?.length) {
    return null
  }
  // first decode any HTML and reduce whitespace
  // trim off all non-pair punctuation and sort longest first (favor longer entries).
  // unique the collection ignoring common, legit trailing punctuation.
  // return the elements in more or less the same order they arrived
  // TODO that last part about ordering is less than optimal right now.
  // TODO remove whitespace after/before pair punctuation (e.g., < this@that.com >)
  const decoded = entries.map(
    (entry: string) =>
      he
        .decode(entry)
        .replace(/(\\[nr]|[\n\r])/g, ' ')
        .replace(/ +/g, ' ')
  )
  const trimmed = decoded.map((entry: string) => trim(entry, ' ~!@#$%^&*_-=+|:;?/,'))
  const sorted = sortBy(trimmed, 'length').reverse()
  return uniqBy(sorted, value => trim(value, '.')).reverse()
}

const dateTimeFormats = ['MM-dd-yyyy']
/**
 * Parses a date/time string into a Luxon DateTime in UTC
 */
function utcDateTime(dateAndTime: string): DateTime | null {
  const utcOpt = { zone: 'utc' }
  let result = DateTime.fromISO(dateAndTime, utcOpt)
  if (!result.isValid) {
    result = DateTime.fromRFC2822(dateAndTime, utcOpt)
  }
  if (!result.isValid) {
    result = DateTime.fromHTTP(dateAndTime, utcOpt)
  }
  if (!result.isValid) {
    result = DateTime.fromSQL(dateAndTime, utcOpt)
  }

  for (let index = 0; !result.isValid && index < dateTimeFormats.length; index++) {
    result = DateTime.fromFormat(dateAndTime, dateTimeFormats[index]!, utcOpt)
  }
  return result.isValid ? result : null
}

/**
 * Extracts and validates a date from various date/time formats
 */
function extractDate(dateAndTime: string | null | undefined): string | null {
  if (!dateAndTime) {
    return null
  }
  const result = utcDateTime(dateAndTime)
  if (!result) {
    return null
  }
  const validStart = utcDateTime('1950-01-01')!
  const validEnd = DateTime.utc().plus({ days: 30 })
  if (result < validStart || result > validEnd) {
    return null
  }
  return result.toISODate() //'yyyy-MM-dd' format
}

/**
 * Compares two ISO date strings
 */
function compareDates(dateA: string | null | undefined, dateB: string | null | undefined): number {
  if (!dateA || !dateB) {
    return dateA ? 1 : dateB ? -1 : 0
  }
  // @ts-expect-error - Date subtraction works in JavaScript
  return DateTime.fromISO(dateA).toJSDate() - DateTime.fromISO(dateB).toJSDate()
}

/**
 * Sets a value at the given path if the value is truthy and not an empty array
 */
function setIfValue(target: object, path: string, value: unknown): boolean {
  if (!value) {
    return false
  }
  if (Array.isArray(value) && value.length === 0) {
    return false
  }
  set(target, path, value)
  return true
}

/**
 * Converts a Set to a sorted array, filtering out falsy values
 */
function setToArray<T>(values: Set<T>): T[] | null {
  const result = Array.from(values)
    .filter(e => e)
    .sort()
  return result.length === 0 ? null : result
}

/**
 * Adds array elements to a Set, optionally extracting values
 */
function addArrayToSet<T, V>(array: T[] | null | undefined, set: Set<V>, valueExtractor?: (value: T) => V): Set<V> {
  if (!array?.length) {
    return set
  }
  valueExtractor =
    valueExtractor || ((value: T) => value as unknown as V)
  for (const entry of array) {
    set.add(valueExtractor(entry))
  }
  return set
}

/**
 * Extracts an SPDX license identifier from a license URL
 */
function extractLicenseFromLicenseUrl(licenseUrl: string | null | undefined): string | null {
  if (!licenseUrl) {
    return null
  }
  for (const licenseUrlOverride of _licenseUrlOverrides) {
    const licenseUrlMatch = licenseUrlOverride.test.exec(licenseUrl)
    if (licenseUrlMatch) {
      if (licenseUrlOverride.license) {
        return licenseUrlOverride.license
      }
      if (licenseUrlOverride.licenseMatchGroup) {
        const parsed = SPDX.normalize(licenseUrlMatch[licenseUrlOverride.licenseMatchGroup]!)
        return parsed === 'NOASSERTION' ? null : parsed
      }
    }
  }
  return null
}

/**
 * Merges the given definition onto the base definition
 */
function mergeDefinitions(base: Definition | null | undefined, proposed: Partial<Definition> | null | undefined, override?: boolean): void {
  if (!proposed) {
    return
  }
  if (!base) {
    return
  }
  setIfValue(base, 'described', _mergeDescribed(base.described, proposed.described))
  setIfValue(base, 'licensed', _mergeLicensed(base.licensed, proposed.licensed, override))
  setIfValue(base, 'files', _mergeFiles(base.files, proposed.files, override))
}

function _mergeFiles(base: FileEntry[] | undefined, proposed: FileEntry[] | undefined, override: boolean | undefined): FileEntry[] | undefined {
  if (!proposed) {
    return base
  }
  if (!base) {
    return proposed
  }
  const baseLookup: Record<string, FileEntry> = base.reduce(
    (result: Record<string, FileEntry>, item: FileEntry) => {
      result[item.path] = item
      return result
    },
    {} as Record<string, FileEntry>
  )
  for (const file of proposed as FileEntry[]) {
    const entry = baseLookup[file.path]
    if (entry) {
      _mergeFile(entry, file, override)
    } else {
      base.push(file)
    }
  }
  return base
}

function _mergeFile(base: FileEntry | undefined, proposed: FileEntry | undefined, override: boolean | undefined): FileEntry | undefined {
  if (!proposed) {
    return base
  }
  if (!base) {
    return proposed
  }
  const result = _mergeExcept(base, proposed, ['license', 'attributions', 'facets', 'hashes', 'natures']) as FileEntry
  const overrideStrategy: <T>(proposed: T, mergeStrategy?: (p: T) => T) => T = override
    ? <T>(proposed: T): T => proposed
    : <T>(proposed: T, mergeStrategy?: (p: T) => T): T => mergeStrategy!(proposed)
  setIfValue(
    result,
    'license',
    overrideStrategy(proposed.license, (p: string | undefined) => SPDX.merge(p!, base.license!, 'AND'))
  )
  setIfValue(
    result,
    'attributions',
    overrideStrategy(
      proposed.attributions,
      (p: string[] | undefined) => _mergeArray(base.attributions, p)
    )
  )
  setIfValue(
    result,
    'facets',
    overrideStrategy(proposed.facets, (p: string[] | undefined) => _mergeArray(base.facets, p))
  )
  setIfValue(
    result,
    'hashes',
    overrideStrategy(
      proposed.hashes,
      (p: Record<string, string> | undefined) => _mergeObject(base.hashes, p)
    )
  )
  setIfValue(
    result,
    'natures',
    overrideStrategy(proposed.natures, (p: string[] | undefined) => _mergeArray(base.natures, p))
  )
  return result
}

function _mergeDescribed(base: {facets?: object, hashes?: object, files?: number} | undefined, proposed: {facets?: object, hashes?: object, files?: number} | undefined): {facets?: object, hashes?: object, files?: number} | undefined {
  if (!proposed) {
    return base
  }
  if (!base) {
    return proposed
  }
  const result = _mergeExcept(base, proposed, ['facets', 'hashes', 'files'])
  setIfValue(result, 'facets', _mergeObject(base.facets, proposed.facets))
  setIfValue(result, 'hashes', _mergeObject(base.hashes, proposed.hashes))
  setIfValue(result, 'files', Math.max(base.files || 0, proposed.files || 0))
  return result
}

/**
 * Merges licensed section, primarily the declared license
 */
function _mergeLicensed(base: {declared?: string} | undefined, proposed: {declared?: string} | undefined, override: boolean | undefined): {declared?: string} | undefined {
  if (!proposed) {
    return base
  }
  if (!base) {
    return proposed
  }
  const result = _mergeExcept(base, proposed, ['declared'])
  setIfValue(result, 'declared', override ? proposed.declared : SPDX.merge(proposed.declared!, base.declared!, 'AND'))
  return result
}

function _mergeObject<T>(base: T | undefined, proposed: T | undefined): T | undefined {
  if (!proposed) {
    return base
  }
  if (!base) {
    return proposed
  }
  return extend(base, proposed)
}

function _mergeArray<T>(base: T[] | undefined, proposed: T[] | undefined): T[] | undefined {
  if (!proposed) {
    return base
  }
  if (!base) {
    return proposed
  }
  return union(base, proposed)
}

function _mergeExcept(base: object, proposed: object, paths: string[] = []): object {
  const overlay = {}
  extend(true, overlay, proposed)
  for (const path of paths) {
    unset(overlay, path)
  }
  extend(true, base, overlay)
  return base
}

/**
 * Builds a source URL for the given coordinates
 */
function buildSourceUrl(spec: EntityCoordinatesSpec): string | null {
  // TODO for now throw away any URL that might be there already due to variances in quality of the data
  // We only support two source providers so anything else is likely bogus.
  switch (spec.provider) {
    case 'github':
      return `https://github.com/${spec.namespace}/${spec.name}/tree/${spec.revision}`
    case 'gitlab': {
      return `https://gitlab.com/${spec.namespace}/${spec.name}/-/tree/${spec.revision}`
    }
    case 'mavencentral': {
      const fullName = `${spec.namespace}/${spec.name}`.replace(/\./g, '/')
      return `https://search.maven.org/remotecontent?filepath=${fullName}/${spec.revision}/${spec.name}-${spec.revision}-sources.jar`
    }
    case 'mavengoogle': {
      //For Google's Maven Repo, sometimes the sources are not present. We simply take the user the version URL and let them verify if the sources exists
      return `https://maven.google.com/web/index.html#${spec.namespace}:${spec.name}:${spec.revision}`
    }
    case 'golang': {
      return `https://pkg.go.dev/${spec.namespace ? `${deCodeSlashes(spec.namespace)}/` : ''}${spec.name}@${spec.revision}`
    }
    case 'pypi': {
      return `https://pypi.org/project/${spec.name}/${spec.revision}/`
    }
    default:
      return null
  }
}

/**
 * Decodes percent-encoded slashes in a namespace
 */
function deCodeSlashes(namespace: string): string {
  return `${namespace.replace(/%2f/gi, '/')}`
}

/**
 * Updates a source location spec to the current format
 */
function updateSourceLocation(spec: SourceLocationSpec): void {
  // if there is a name then this is the new style source location so just use it
  if (spec.name) {
    return
  }

  if (spec.provider === 'github' || spec.provider === 'gitlab') {
    const segments = spec.url!.split('/')
    spec.namespace = segments[3]
    spec.name = segments[4]
  }

  if (spec.provider === 'mavencentral' || spec.provider === 'mavengoogle') {
    // handle old style maven data
    const [namespace, name] = spec.url!.split('/')
    spec.namespace = namespace
    spec.name = name
  }
}

/**
 * Determine if a given filePath is a license file based on name
 */
function isLicenseFile(filePath: string | null | undefined, coordinates?: EntityCoordinates, packages?: PackageInfo[]): boolean {
  if (!filePath) {
    return false
  }
  filePath = filePath.toLowerCase()
  const basePath = filePath.split('/')[0]!
  if (_licenseFileNames.includes(basePath)) {
    return true
  }
  if (!coordinates) {
    return false
  }
  for (const prefix of getLicenseLocations(coordinates, packages) || []) {
    const prefixLowered = prefix.toLowerCase()
    if (_licenseFileNames.includes(filePath.replace(prefixLowered, ''))) {
      return true
    }
  }
  return false
}

/**
 * Determine if a given string is a declared license
 */
function isDeclaredLicense(identifier: string | null | undefined): boolean {
  return !!(identifier && identifier !== 'NOASSERTION' && identifier !== 'NONE')
}

/**
 * Gets the license file location prefixes for a given coordinate type
 */
function getLicenseLocations(coordinates: EntityCoordinates, packages?: PackageInfo[]): string[] | undefined {
  const map: Record<string, string[]> = {
    npm: ['package/'],
    maven: ['META-INF/'],
    pypi: [`${coordinates.name}-${coordinates.revision}/`],
    go: [goLicenseLocation(coordinates)],
    debsrc: packages ? debsrcLicenseLocations(packages) : [] as string[]
  }
  map.sourcearchive = map.maven!
  return map[coordinates.type!]
}

function goLicenseLocation(coordinates: EntityCoordinates): string {
  if (coordinates.namespace?.toLowerCase().includes('%2f')) {
    return `${deCodeSlashes(coordinates.namespace)}/${coordinates.name}@${coordinates.revision}/`
  }
  return `${coordinates.namespace}/${coordinates.name}@${coordinates.revision}/`
}

/**
 * Gets license locations for debsrc packages
 */
function debsrcLicenseLocations(packages: PackageInfo[]): string[] {
  const licenseLocations: string[] = []

  // Split packages of `type: deb` and other packages
  const [debPackages, otherPackages] = packages.reduce(
    ([debPackages, otherPackages]: [PackageInfo[], PackageInfo[]], pkg: PackageInfo): [PackageInfo[], PackageInfo[]] => {
      if (pkg.type === 'deb') {
        debPackages.push(pkg)
      } else {
        otherPackages.push(pkg)
      }
      return [debPackages, otherPackages]
    },
    [[], []] as [PackageInfo[], PackageInfo[]]
  )

  // Add default location for debian packages
  if (debPackages.length) {
    licenseLocations.push('debian/')
  }

  // Add license locations based on package name and version for other packages
  return licenseLocations.concat(
    otherPackages.map(
      (otherPackage: PackageInfo) =>
        otherPackage.version ? `${otherPackage.name}-${otherPackage.version}/` : `${otherPackage.name}/`
    )
  )
}

/**
 * Joins a set of license expressions with AND
 */
function joinExpressions(expressions: Set<string> | null | undefined): string | null {
  if (!expressions) {
    return null
  }
  const list = setToArray(expressions)
  if (!list) {
    return null
  }
  const joinedExpressionString = `(${list.join(') AND (')})`
  return SPDX.normalize(joinedExpressionString)
}

/**
 * Normalizes a raw license expression to SPDX format
 */
function normalizeLicenseExpression(
  rawLicenseExpression: string | null | undefined,
  logger: {info: (message: string) => void},
  licenseRefLookup?: (token: string) => string | null | undefined
): string | null {
  if (!rawLicenseExpression) {
    return null
  }

  const licenseVisitor = (licenseExpression: string) =>
    scancodeMap.get(licenseExpression) || SPDX.normalizeSingle(licenseExpression)
  const lookup = licenseRefLookup || ((token: string): string | null => (token && scancodeMap.get(token)) ?? null)
  const parsed = SPDX.parse(rawLicenseExpression, licenseVisitor, lookup as any)
  const result = SPDX.stringify(parsed)
  if (result === 'NOASSERTION') {
    logger.info(`ScanCode NOASSERTION from ${rawLicenseExpression}`)
  }

  return result
}

/**
 * Normalizes a version string to semver format
 */
function _normalizeVersion(version: string): string | null {
  if (version === '1') {
    return '1.0.0' // version '1' is not semver valid see https://github.com/clearlydefined/crawler/issues/124
  }
  return semver.valid(version) ? version : null
}

/**
 * Parses a URN string into its component parts
 */
function parseUrn(urn: string | null | undefined): ParsedUrn {
  if (!urn) {
    return {}
  }
  const [scheme, type, provider, namespace, name, revToken, revision, toolToken, tool, toolRevision] = urn.split(':')
  return {
    scheme,
    type,
    provider,
    namespace,
    name,
    revToken,
    revision,
    toolToken,
    tool,
    toolRevision
  }
}

const _licenseFileNames = [
  'license',
  'licence',
  'license.txt',
  'licence.txt',
  'license.md',
  'licence.md',
  'license.html',
  'licence.html',
  'license-mit',
  'licence-mit',
  'license-mit.txt',
  'licence-mit.txt',
  'license-mit.md',
  'licence-mit.md',
  'license-mit.html',
  'licence-mit.html',
  'license-apache',
  'licence-apache',
  'license-apache.txt',
  'licence-apache.txt',
  'license-apache.md',
  'licence-apache.md',
  'license-apache.html',
  'licence-apache.html',
  'copying',
  'copying.txt',
  'copying.md',
  'copying.html'
]

const _licenseUrlOverrides = [
  {
    test: /^\w*https?:\/\/(?:www\.)?opensource\.org\/licenses\/mit-license(\.php)?$/i,
    license: 'MIT'
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?opensource\.org\/licenses\/bsd-license(\.php)?$/i,
    license: 'BSD-2-Clause'
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?opensource\.org\/licenses\/(.*?)(\.php|\.txt|\.html)?$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*http(s)?:\/\/(www\.)?apache.org\/licenses\/LICENSE-2\.0(.html|.txt)?$/i,
    license: 'Apache-2.0'
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?gnu.org\/licenses\/lgpl.(html|txt)(.*?)$/i,
    license: 'LGPL-3.0'
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?gnu\.org\/licenses\/lgpl-2\.1\.(html|txt)$/i,
    license: 'LGPL-2.1'
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?gnu\.org\/licenses\/old-licenses\/(.*?)(\.en)?(\.html)?$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?gnu\.org\/licenses\/(.*?)(\.en)?(\.html)?$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*https?:\/\/(?:www.)?licenses\.nuget\.org\/(.*?)$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?json\.org\/license\.html$/i,
    license: 'JSON'
  },
  {
    test: /^\w*https:\/\/(?:www\.)?tldrlegal\.com\/license\/gnu-general-public-license-v3-\(gpl-3\)$/i,
    license: 'GPL-3.0'
  },
  {
    test: /^\w*https:\/\/(?:www\.)?tldrlegal\.com\/license\/(?:.*?)\((.*)\)$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*https:\/\/(?:www\.)?tldrlegal\.com\/license\/(.*?)(-license)?$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*https?:\/\/raw.githubusercontent.com\/aspnet\/(AspNetCore|Home)\/2.0.0\/LICENSE.txt/i,
    license: 'Apache-2.0'
  },
  {
    test: /^\w*https?:\/\/raw\.githubusercontent\.com\/NuGet\/NuGet\.Client\/dev\/LICENSE\.txt/i,
    license: 'Apache-2.0'
  },
  {
    test: /^\w*https?:\/\/github.com\/DefinitelyTyped\/NugetAutomation\/blob\/master\/LICENSE.MIT/i,
    license: 'MIT'
  },
  {
    test: /^\w*https?:\/\/aws.amazon.com\/apache2.0(.*?)/i,
    license: 'Apache-2.0'
  },
  {
    test: /^\w*https?:\/\/www\.github\.com\/fsharp\/Fake\/blob\/master\/License\.txt/i,
    license: 'Apache-2.0 AND MS-PL'
  },
  {
    test: /^\w*https?:\/\/github.com\/MassTransit\/MassTransit\/blob\/master\/LICENSE/i,
    license: 'Apache-2.0'
  },
  {
    test: /^\w*https?:\/\/github.com\/fluffynuts\/PeanutButter\/blob\/master\/LICENSE/i,
    license: 'BSD-3-Clause'
  },
  {
    test: /^\w*https?:\/\/github.com\/aspnetboilerplate\/aspnetboilerplate\/blob\/master\/LICENSE/i,
    license: 'MIT'
  },
  {
    test: /^\w*https?:\/\/raw.githubusercontent.com\/(Microsoft\/dotnet|rebus-org\/Rebus)\/master\/LICENSE(.*?)/i,
    license: 'MIT'
  },
  {
    test: /^\w*https?:\/\/github.com\/(dotnet\/corefx|dotnet\/docfx|dotnetcore\/Util|rsuter\/NJsonSchema)\/blob\/(dev|master)\/LICENSE(.*?)$/i,
    license: 'MIT'
  },
  // EULA licenses should be defined as OTHER
  { test: /^https?:\/\/aka\.ms\/(devservicesagreement|pexunj)/i, license: 'OTHER' },
  { test: /^https?:\/\/applitools.com\/eula\/sdk/i, license: 'OTHER' },
  { test: /^https?:\/\/company\.aspose\.com\/legal\/eula/i, license: 'OTHER' },
  { test: /^https?:\/\/www\.componentone\.com\/SuperPages\/DevToolsEULA/i, license: 'OTHER' },
  { test: /^https?:\/\/(www|js)\.devexpress\.com(\/.+)?\/eulas/i, license: 'OTHER' },
  { test: /^https?:\/\/dlhsoft.com\/LicenseAgreements\/(.*)?EULA.rtf/i, license: 'OTHER' },
  { test: /^https?:\/\/www\.essentialobjects\.com(\/.+)?\/EULA\.aspx/i, license: 'OTHER' },
  {
    test: /^https?:\/\/go\.microsoft\.com(\/.*)?\/?\?linkid=(214339|218949|235167|248155|253898|259741|261796|262998|272666|273778|281843|317295|320539|329770|529443|536623|614949|698879|746386|832965|838619|838620|9809688|9862941)/i,
    license: 'OTHER'
  },
  { test: /^https?:\/\/kusto\.blob\.core\.windows\.net\/kusto-nuget\/EULA-agreement\.htm/i, license: 'OTHER' },
  { test: /^https?:\/\/www\.microsoft\.com(\/.+)?\/web\/webpi\/eula\//i, license: 'OTHER' },
  { test: /^https?:\/\/pdfium\.patagames\.com\/faq\/eula/i, license: 'OTHER' },
  { test: /^https?:\/\/specflow.org\/plus\/eula\//i, license: 'OTHER' },
  { test: /^https?:\/\/www\.streamcoders\.com\/products\/msneteula\.html/i, license: 'OTHER' },
  { test: /^https?:\/\/workflowenginenet.com\/EULA/i, license: 'OTHER' },
  { test: /^https?:\/\/aka.ms\/azureml-sdk-license/i, license: 'OTHER' },
  {
    test: /^\w*https?:\/\/(?:www\.)?eclipse\.org\/legal\/epl-v10\.html$/i,
    license: 'EPL-1.0'
  },
  {
    test: /^https?:\/\/(?:www\.)?eclipse\.org\/legal\/epl-2\.0\/?$/i,
    license: 'EPL-2.0'
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?mozilla\.org(?:\/en-US)?\/MPL\/(MPL-1\.1\.html|1\.1\/)$/i,
    license: 'MPL-1.1'
  },
  {
    test: /^https?:\/\/(?:www\.)?mozilla\.org(?:\/en-US)?\/MPL\/2\.0\/$/i,
    license: 'MPL-2.0'
  },
  {
    test: /^\w*https?:\/\/(?:www\.)?eclipse\.org\/org\/documents\/edl-v10\.php$/i,
    license: 'BSD-3-Clause'
  },
  {
    test: /^https?:\/\/glassfish\.(dev\.java\.net|java\.net)\/public\/CDDL\+GPL_1_1\.html$/i,
    license: 'CDDL-1.1 OR GPL-2.0-only WITH Classpath-exception-2.0'
  },
  {
    test: /^https?:\/\/glassfish\.(dev\.java\.net|java\.net)\/public\/CDDL(\+|%2B)GPL\.html$/i,
    license: 'CDDL-1.0 OR GPL-2.0-only WITH Classpath-exception-2.0'
  },
  {
    test: /^https?:\/\/glassfish\.(dev\.java\.net|java\.net)\/public\/CDDLv1\.0\.html$/i,
    license: 'CDDL-1.0'
  }
]

export {
  addArrayToSet,
  buildSourceUrl,
  compareDates,
  deCodeSlashes,
  extractDate,
  extractLicenseFromLicenseUrl,
  getLatestVersion,
  getLicenseLocations,
  isDeclaredLicense,
  isLicenseFile,
  joinExpressions,
  mergeDefinitions,
  normalizeLicenseExpression,
  parseNamespaceNameRevision,
  parseUrn,
  setIfValue,
  setToArray,
  simplifyAttributions,
  toEntityCoordinatesFromArgs,
  toEntityCoordinatesFromRequest,
  toNormalizedEntityCoordinates,
  toResultCoordinatesFromRequest,
  updateSourceLocation
}
