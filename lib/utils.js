// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('./utils').EntityCoordinatesRequest} EntityCoordinatesRequest */
/** @typedef {import('./utils').Definition} Definition */
/** @typedef {import('./utils').FileEntry} FileEntry */
/** @typedef {import('./utils').SourceLocationSpec} SourceLocationSpec */
/** @typedef {import('./utils').PackageInfo} PackageInfo */
/** @typedef {import('./utils').ParsedUrn} ParsedUrn */
/** @typedef {import('./entityCoordinates').EntityCoordinatesSpec} EntityCoordinatesSpec */

const semver = require('semver')
const he = require('he')
const EntityCoordinates = require('./entityCoordinates')
const ResultCoordinates = require('./resultCoordinates')
const { DateTime } = require('luxon')
const { set, unset, union, sortBy, trim, uniqBy } = require('lodash')
// @ts-ignore - extend module has no types
const extend = require('extend')
const SPDX = require('@clearlydefined/spdx')
const scancodeMap = require('./scancodeMap')
const coordinatesMapper = require('./coordinatesMapper')()

/**
 * Creates ResultCoordinates from an Express request with tool parameters
 * @param {EntityCoordinatesRequest} request - Express request with entity and tool params
 * @returns {Promise<ResultCoordinates>} ResultCoordinates instance
 */
async function toResultCoordinatesFromRequest(request) {
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
 * @param {EntityCoordinatesRequest} request - Express request with entity params
 * @returns {Promise<EntityCoordinates>} EntityCoordinates instance
 */
async function toEntityCoordinatesFromRequest(request) {
  const coordinates = new EntityCoordinates(
    request.params.type,
    request.params.provider,
    request.params.namespace === '-' ? null : reEncodeSlashes(request.params.namespace),
    request.params.name,
    request.params.revision
  )
  return await toNormalizedEntityCoordinates(coordinates)
}

/**
 * Normalizes EntityCoordinates using coordinate mappers
 * @param {EntityCoordinatesSpec} spec - Entity coordinates specification
 * @returns {Promise<EntityCoordinates>} Normalized EntityCoordinates
 */
async function toNormalizedEntityCoordinates(spec) {
  const coordinates = EntityCoordinates.fromObject(spec)
  return await coordinatesMapper.map(coordinates)
}

/**
 * Creates EntityCoordinates from command-line style arguments
 * @param {Record<string, string>} args - Object with type, provider, namespace, name, revision keys
 * @returns {EntityCoordinates} EntityCoordinates instance
 */
function toEntityCoordinatesFromArgs(args) {
  return new EntityCoordinates(
    args['type'],
    args['provider'],
    args['namespace'] === '-' ? null : reEncodeSlashes(args['namespace']),
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
 * @param {string} namespace - Namespace string
 * @returns {string} Namespace with slashes encoded as %2f
 */
function reEncodeSlashes(namespace) {
  return `${namespace.replace(/\//g, '%2f')}`
}

/**
 * Parses namespace/name/revision from request params including extras
 * @param {EntityCoordinatesRequest} request - Express request with params
 * @returns {string} Combined path string
 */
function parseNamespaceNameRevision(request) {
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
 * @param {string | string[]} versions - Array of version strings or a single version
 * @returns {string | null} The latest non-prerelease version, or null if none found
 */
function getLatestVersion(versions) {
  if (!Array.isArray(versions)) return versions
  if (versions.length === 0) return null
  if (versions.length === 1) return versions[0]
  return versions.reduce(
    /**
     * @param {string} max
     * @param {string} current
     */
    (max, current) => {
      const normalizedCurrent = _normalizeVersion(current)
      if (!normalizedCurrent || semver.prerelease(normalizedCurrent) !== null) return max
      const normalizedMax = _normalizeVersion(max)
      if (!normalizedMax) return normalizedCurrent
      return semver.gt(normalizedCurrent, normalizedMax) ? current : max
    },
    versions[0]
  )
}

/**
 * Simplifies and deduplicates attribution strings
 * @param {string[] | null | undefined} entries - Array of attribution strings
 * @returns {string[] | null} Simplified array or null if empty
 */
function simplifyAttributions(entries) {
  if (!entries || !entries.length) return null
  // first decode any HTML and reduce whitespace
  // trim off all non-pair punctuation and sort longest first (favor longer entries).
  // unique the collection ignoring common, legit trailing punctuation.
  // return the elements in more or less the same order they arrived
  // TODO that last part about ordering is less than optimal right now.
  // TODO remove whitespace after/before pair punctuation (e.g., < this@that.com >)
  const decoded = entries.map(
    /** @param {string} entry */ entry =>
      he
        .decode(entry)
        .replace(/(\\[nr]|[\n\r])/g, ' ')
        .replace(/ +/g, ' ')
  )
  const trimmed = decoded.map(/** @param {string} entry */ entry => trim(entry, ' ~!@#$%^&*_-=+|:;?/,'))
  const sorted = sortBy(trimmed, 'length').reverse()
  return uniqBy(sorted, value => trim(value, '.')).reverse()
}

const dateTimeFormats = ['MM-dd-yyyy']
/**
 * Parses a date/time string into a Luxon DateTime in UTC
 * @param {string} dateAndTime - Date string in various formats
 * @returns {import('luxon').DateTime | null} DateTime instance or null if invalid
 */
function utcDateTime(dateAndTime) {
  const utcOpt = { zone: 'utc' }
  let result = DateTime.fromISO(dateAndTime, utcOpt)
  if (!result.isValid) result = DateTime.fromRFC2822(dateAndTime, utcOpt)
  if (!result.isValid) result = DateTime.fromHTTP(dateAndTime, utcOpt)
  if (!result.isValid) result = DateTime.fromSQL(dateAndTime, utcOpt)

  for (let index = 0; !result.isValid && index < dateTimeFormats.length; index++) {
    result = DateTime.fromFormat(dateAndTime, dateTimeFormats[index], utcOpt)
  }
  return result.isValid ? result : null
}

/**
 * Extracts and validates a date from various date/time formats
 * @param {string | null | undefined} dateAndTime - Date string in various formats
 * @returns {string | null} ISO date string (yyyy-MM-dd) or null if invalid
 */
function extractDate(dateAndTime) {
  if (!dateAndTime) return null
  const result = utcDateTime(dateAndTime)
  if (!result) return null
  const instant = result.until(result)
  const validStart = utcDateTime('1950-01-01')
  const validEnd = DateTime.utc().plus({ days: 30 })
  if (instant.isBefore(validStart) || instant.isAfter(validEnd)) return null
  return result.toISODate() //'yyyy-MM-dd' format
}

/**
 * Compares two ISO date strings
 * @param {string | null | undefined} dateA - First date string
 * @param {string | null | undefined} dateB - Second date string
 * @returns {number} Negative if dateA < dateB, positive if dateA > dateB, 0 if equal
 */
function compareDates(dateA, dateB) {
  if (!dateA || !dateB) return dateA ? 1 : dateB ? -1 : 0
  // @ts-ignore - Date subtraction works in JavaScript
  return DateTime.fromISO(dateA).toJSDate() - DateTime.fromISO(dateB).toJSDate()
}

/**
 * Sets a value at the given path if the value is truthy and not an empty array
 * @param {object} target - Object to set the value on
 * @param {string} path - Lodash-style path string
 * @param {unknown} value - Value to set
 * @returns {boolean} true if value was set, false otherwise
 */
function setIfValue(target, path, value) {
  if (!value) return false
  if (Array.isArray(value) && value.length === 0) return false
  set(target, path, value)
  return true
}

/**
 * Converts a Set to a sorted array, filtering out falsy values
 * @template T
 * @param {Set<T>} values - Set of values
 * @returns {T[] | null} Sorted array or null if empty
 */
function setToArray(values) {
  const result = Array.from(values)
    .filter(e => e)
    .sort()
  return result.length === 0 ? null : result
}

/**
 * Adds array elements to a Set, optionally extracting values
 * @template T, V
 * @param {T[] | null | undefined} array - Array of values to add
 * @param {Set<V>} set - Set to add values to
 * @param {((value: T) => V) | undefined} [valueExtractor] - Optional function to extract value from each element
 * @returns {Set<V>} The modified Set
 */
function addArrayToSet(array, set, valueExtractor) {
  if (!array || !array.length) return set
  valueExtractor =
    valueExtractor || /** @param {T} value */ (value => /** @type {V} */ (/** @type {unknown} */ (value)))
  for (let entry of array) set.add(valueExtractor(entry))
  return set
}

/**
 * Extracts an SPDX license identifier from a license URL
 * @param {string | null | undefined} licenseUrl - URL pointing to a license
 * @returns {string | null} SPDX license identifier or null
 */
function extractLicenseFromLicenseUrl(licenseUrl) {
  if (!licenseUrl) return null
  for (const licenseUrlOverride of _licenseUrlOverrides) {
    const licenseUrlMatch = licenseUrlOverride.test.exec(licenseUrl)
    if (licenseUrlMatch) {
      if (licenseUrlOverride.license) return licenseUrlOverride.license
      if (licenseUrlOverride.licenseMatchGroup) {
        const parsed = SPDX.normalize(licenseUrlMatch[licenseUrlOverride.licenseMatchGroup])
        return parsed === 'NOASSERTION' ? null : parsed
      }
    }
  }
  return null
}

/**
 * Merges the given definition onto the base definition
 * @param {Definition | null | undefined} base - Base definition to merge onto
 * @param {Partial<Definition> | null | undefined} proposed - Proposed changes to merge
 * @param {boolean} [override] - If true, proposed values override rather than merge
 * @returns {void}
 */
function mergeDefinitions(base, proposed, override) {
  if (!proposed) return
  if (!base) return
  setIfValue(base, 'described', _mergeDescribed(base.described, proposed.described))
  setIfValue(base, 'licensed', _mergeLicensed(base.licensed, proposed.licensed, override))
  setIfValue(base, 'files', _mergeFiles(base.files, proposed.files, override))
}

/**
 * @param {FileEntry[] | undefined} base
 * @param {FileEntry[] | undefined} proposed
 * @param {boolean | undefined} override
 * @returns {FileEntry[] | undefined}
 */
function _mergeFiles(base, proposed, override) {
  if (!proposed) return base
  if (!base) return proposed
  /** @type {Record<string, FileEntry>} */
  const baseLookup = base.reduce(
    /**
     * @param {Record<string, FileEntry>} result
     * @param {FileEntry} item
     */
    (result, item) => {
      result[item.path] = item
      return result
    },
    /** @type {Record<string, FileEntry>} */ ({})
  )
  proposed.forEach(
    /** @param {FileEntry} file */ file => {
      const entry = baseLookup[file.path]
      if (entry) _mergeFile(entry, file, override)
      else base.push(file)
    }
  )
  return base
}

/**
 * @param {FileEntry | undefined} base
 * @param {FileEntry | undefined} proposed
 * @param {boolean | undefined} override
 * @returns {FileEntry | undefined}
 */
function _mergeFile(base, proposed, override) {
  if (!proposed) return base
  if (!base) return proposed
  const result = /** @type {FileEntry} */ (
    _mergeExcept(base, proposed, ['license', 'attributions', 'facets', 'hashes', 'natures'])
  )
  /** @type {<T>(proposed: T, mergeStrategy?: (p: T) => T) => T} */
  const overrideStrategy = override
    ? /** @type {<T>(proposed: T) => T} */ (proposed => proposed)
    : /** @type {<T>(proposed: T, mergeStrategy: (p: T) => T) => T} */ (
        (proposed, mergeStrategy) => mergeStrategy(proposed)
      )
  setIfValue(
    result,
    'license',
    overrideStrategy(proposed.license, /** @param {string | undefined} p */ p => SPDX.merge(p, base.license, 'AND'))
  )
  setIfValue(
    result,
    'attributions',
    overrideStrategy(
      proposed.attributions,
      /** @param {string[] | undefined} p */ p => _mergeArray(base.attributions, p)
    )
  )
  setIfValue(
    result,
    'facets',
    overrideStrategy(proposed.facets, /** @param {string[] | undefined} p */ p => _mergeArray(base.facets, p))
  )
  setIfValue(
    result,
    'hashes',
    overrideStrategy(
      proposed.hashes,
      /** @param {Record<string, string> | undefined} p */ p => _mergeObject(base.hashes, p)
    )
  )
  setIfValue(
    result,
    'natures',
    overrideStrategy(proposed.natures, /** @param {string[] | undefined} p */ p => _mergeArray(base.natures, p))
  )
  return result
}

/**
 * @param {{facets?: object, hashes?: object, files?: number} | undefined} base
 * @param {{facets?: object, hashes?: object, files?: number} | undefined} proposed
 * @returns {{facets?: object, hashes?: object, files?: number} | undefined}
 */
function _mergeDescribed(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['facets', 'hashes', 'files'])
  setIfValue(result, 'facets', _mergeObject(base.facets, proposed.facets))
  setIfValue(result, 'hashes', _mergeObject(base.hashes, proposed.hashes))
  setIfValue(result, 'files', Math.max(base.files || 0, proposed.files || 0))
  return result
}

/**
 * Merges licensed section, primarily the declared license
 * @param {{declared?: string} | undefined} base
 * @param {{declared?: string} | undefined} proposed
 * @param {boolean | undefined} override
 * @returns {{declared?: string} | undefined}
 */
function _mergeLicensed(base, proposed, override) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['declared'])
  setIfValue(result, 'declared', override ? proposed.declared : SPDX.merge(proposed.declared, base.declared, 'AND'))
  return result
}

/**
 * @template T
 * @param {T | undefined} base
 * @param {T | undefined} proposed
 * @returns {T | undefined}
 */
function _mergeObject(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  return extend(base, proposed)
}

/**
 * @template T
 * @param {T[] | undefined} base
 * @param {T[] | undefined} proposed
 * @returns {T[] | undefined}
 */
function _mergeArray(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  return union(base, proposed)
}

/**
 * @param {object} base
 * @param {object} proposed
 * @param {string[]} [paths]
 * @returns {object}
 */
function _mergeExcept(base, proposed, paths = []) {
  const overlay = {}
  extend(true, overlay, proposed)
  paths.forEach(path => unset(overlay, path))
  extend(true, base, overlay)
  return base
}

/**
 * Builds a source URL for the given coordinates
 * @param {EntityCoordinatesSpec} spec - Entity coordinates specification
 * @returns {string | null} Source URL or null if provider not supported
 */
function buildSourceUrl(spec) {
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
 * @param {string} namespace - Namespace string with possible %2f encodings
 * @returns {string} Decoded namespace string
 */
function deCodeSlashes(namespace) {
  return `${namespace.replace(/%2f/gi, '/')}`
}

/**
 * Updates a source location spec to the current format
 * @param {SourceLocationSpec} spec - Source location to update in place
 */
function updateSourceLocation(spec) {
  // if there is a name then this is the new style source location so just use it
  if (spec.name) return

  if (spec.provider === 'github' || spec.provider === 'gitlab') {
    const segments = spec.url.split('/')
    spec.namespace = segments[3]
    spec.name = segments[4]
  }

  if (spec.provider === 'mavencentral' || spec.provider === 'mavengoogle') {
    // handle old style maven data
    const [namespace, name] = spec.url.split('/')
    spec.namespace = namespace
    spec.name = name
  }
}

/**
 * Determine if a given filePath is a license file based on name
 * Checks deeper than the root depending on coordinate type
 *
 * @param {string} filePath
 * @param {EntityCoordinates} [coordinates] - optional to look deeper than the root based on coordinate type
 * @param {PackageInfo[]} [packages] - optional, to look at package directories
 * @returns {boolean}
 */
function isLicenseFile(filePath, coordinates, packages) {
  if (!filePath) return false
  filePath = filePath.toLowerCase()
  const basePath = filePath.split('/')[0]
  if (_licenseFileNames.includes(basePath)) return true
  if (!coordinates) return false
  for (const prefix of getLicenseLocations(coordinates, packages) || []) {
    const prefixLowered = prefix.toLowerCase()
    if (_licenseFileNames.includes(filePath.replace(prefixLowered, ''))) return true
  }
  return false
}

/**
 * Determine if a given string is a declared license
 * To be a declared license it must be set and not be NOASSERTION nor NONE
 *
 * @param {string} identifier
 * @returns {boolean}
 */
function isDeclaredLicense(identifier) {
  return identifier && identifier !== 'NOASSERTION' && identifier !== 'NONE'
}

/**
 * Gets the license file location prefixes for a given coordinate type
 * @param {EntityCoordinates} coordinates - Entity coordinates
 * @param {PackageInfo[]} [packages] - Optional package info for debsrc
 * @returns {string[] | undefined} Array of path prefixes where license files may be found
 */
function getLicenseLocations(coordinates, packages) {
  /** @type {Record<string, string[]>} */
  const map = {
    npm: ['package/'],
    maven: ['META-INF/'],
    pypi: [`${coordinates.name}-${coordinates.revision}/`],
    go: [goLicenseLocation(coordinates)],
    debsrc: packages ? debsrcLicenseLocations(packages) : []
  }
  // @ts-ignore - dynamically adding sourcearchive property
  map.sourcearchive = map.maven
  // @ts-ignore - dynamic key access
  return map[coordinates.type]
}

/**
 * @param {EntityCoordinates} coordinates
 * @returns {string}
 */
function goLicenseLocation(coordinates) {
  if (coordinates.namespace && coordinates.namespace.toLowerCase().includes('%2f')) {
    return `${deCodeSlashes(coordinates.namespace)}/${coordinates.name}@${coordinates.revision}/`
  } else {
    return `${coordinates.namespace}/${coordinates.name}@${coordinates.revision}/`
  }
}

/**
 * Gets license locations for debsrc packages
 * @param {PackageInfo[]} packages
 * @returns {string[]}
 */
function debsrcLicenseLocations(packages) {
  /** @type {string[]} */
  const licenseLocations = []

  // Split packages of `type: deb` and other packages
  const [debPackages, otherPackages] = packages.reduce(
    /**
     * @param {[PackageInfo[], PackageInfo[]]} acc
     * @param {PackageInfo} pkg
     * @returns {[PackageInfo[], PackageInfo[]]}
     */
    ([debPackages, otherPackages], pkg) => {
      if (pkg.type === 'deb') {
        debPackages.push(pkg)
      } else {
        otherPackages.push(pkg)
      }
      return [debPackages, otherPackages]
    },
    [[], []]
  )

  // Add default location for debian packages
  if (debPackages.length) {
    licenseLocations.push('debian/')
  }

  // Add license locations based on package name and version for other packages
  return licenseLocations.concat(
    otherPackages.map(
      /** @param {PackageInfo} otherPackage */ otherPackage =>
        otherPackage.version ? `${otherPackage.name}-${otherPackage.version}/` : `${otherPackage.name}/`
    )
  )
}

/**
 * Joins a set of license expressions with AND
 * @param {Set<string> | null | undefined} expressions - Set of SPDX expressions
 * @returns {string | null} Normalized combined expression or null
 */
function joinExpressions(expressions) {
  if (!expressions) return null
  const list = setToArray(expressions)
  if (!list) return null
  const joinedExpressionString = `(${list.join(') AND (')})`
  return SPDX.normalize(joinedExpressionString)
}

/**
 * Normalizes a raw license expression to SPDX format
 * @param {string | null | undefined} rawLicenseExpression - Raw license expression string
 * @param {{info: (message: string) => void}} logger - Logger instance for warnings
 * @param {((token: string) => string | undefined)} [licenseRefLookup] - Optional function to resolve license references
 * @returns {string | null} Normalized SPDX expression or null
 */
function normalizeLicenseExpression(
  rawLicenseExpression,
  logger,
  licenseRefLookup = /** @param {string} token */ token => token && scancodeMap.get(token)
) {
  if (!rawLicenseExpression) return null

  /** @param {string} licenseExpression */
  const licenseVisitor = licenseExpression =>
    scancodeMap.get(licenseExpression) || SPDX.normalizeSingle(licenseExpression)
  const parsed = SPDX.parse(rawLicenseExpression, licenseVisitor, licenseRefLookup)
  const result = SPDX.stringify(parsed)
  if (result === 'NOASSERTION') logger.info(`ScanCode NOASSERTION from ${rawLicenseExpression}`)

  return result
}

/**
 * Normalizes a version string to semver format
 * @param {string} version
 * @returns {string | null}
 */
function _normalizeVersion(version) {
  if (version == '1') return '1.0.0' // version '1' is not semver valid see https://github.com/clearlydefined/crawler/issues/124
  return semver.valid(version) ? version : null
}

/**
 * Parses a URN string into its component parts
 * @param {string | null | undefined} urn - URN string to parse
 * @returns {ParsedUrn} Object with parsed URN components
 */
function parseUrn(urn) {
  if (!urn) return {}
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
    test: /^\w*https?:\/\/(?:www.)?json\.org\/license\.html$/i,
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
    test: /^\w*https?:\/\/raw.githubusercontent.com\/NuGet\/NuGet.Client\/dev\/LICENSE.txt/i,
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
    test: /^\w*https?:\/\/www.github.com\/fsharp\/Fake\/blob\/master\/License.txt/i,
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
  { test: /^https?:\/\/company.aspose.com\/legal\/eula/i, license: 'OTHER' },
  { test: /^https?:\/\/www.componentone.com\/SuperPages\/DevToolsEULA/i, license: 'OTHER' },
  { test: /^https?:\/\/(www|js).devexpress.com(\/.+)?\/eulas/i, license: 'OTHER' },
  { test: /^https?:\/\/dlhsoft.com\/LicenseAgreements\/(.*)?EULA.rtf/i, license: 'OTHER' },
  { test: /^https?:\/\/www.essentialobjects.com(\/.+)?\/EULA.aspx/i, license: 'OTHER' },
  {
    test: /^https?:\/\/go\.microsoft\.com(\/.*)?\/?\?linkid=(214339|218949|235167|248155|253898|259741|261796|262998|272666|273778|281843|317295|320539|329770|529443|536623|614949|698879|746386|832965|838619|838620|9809688|9862941)/i,
    license: 'OTHER'
  },
  { test: /^https?:\/\/kusto.blob.core.windows.net\/kusto-nuget\/EULA-agreement.htm/i, license: 'OTHER' },
  { test: /^https?:\/\/www\.microsoft\.com(\/.+)?\/web\/webpi\/eula\//i, license: 'OTHER' },
  { test: /^https?:\/\/pdfium.patagames.com\/faq\/eula/i, license: 'OTHER' },
  { test: /^https?:\/\/specflow.org\/plus\/eula\//i, license: 'OTHER' },
  { test: /^https?:\/\/www.streamcoders.com\/products\/msneteula.html/i, license: 'OTHER' },
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

module.exports = {
  toEntityCoordinatesFromRequest,
  toResultCoordinatesFromRequest,
  toEntityCoordinatesFromArgs,
  toNormalizedEntityCoordinates,
  getLatestVersion,
  extractDate,
  compareDates,
  setIfValue,
  setToArray,
  addArrayToSet,
  extractLicenseFromLicenseUrl,
  getLicenseLocations,
  joinExpressions,
  normalizeLicenseExpression,
  mergeDefinitions,
  buildSourceUrl,
  deCodeSlashes,
  updateSourceLocation,
  isLicenseFile,
  simplifyAttributions,
  isDeclaredLicense,
  parseUrn,
  parseNamespaceNameRevision
}
