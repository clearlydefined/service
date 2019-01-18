// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const semver = require('semver')
const EntityCoordinates = require('./entityCoordinates')
const ResultCoordinates = require('./resultCoordinates')
const moment = require('moment')
const { set, find, unset, union } = require('lodash')
const extend = require('extend')
const SPDX = require('./spdx')

function toResultCoordinatesFromRequest(request) {
  return new ResultCoordinates(
    request.params.type,
    request.params.provider,
    request.params.namespace === '-' ? null : request.params.namespace,
    request.params.name,
    request.params.revision,
    request.params.tool,
    request.params.toolVersion
  )
}

function toEntityCoordinatesFromRequest(request) {
  return new EntityCoordinates(
    request.params.type,
    request.params.provider,
    request.params.namespace === '-' ? null : request.params.namespace,
    request.params.name,
    request.params.revision
  )
}

function getLatestVersion(versions) {
  if (!Array.isArray(versions)) return versions
  if (versions.length === 0) return null
  if (versions.length === 1) return versions[0]
  return versions.reduce((max, current) => {
    const normalizedCurrent = _normalizeVersion(current)
    if (!normalizedCurrent || semver.prerelease(normalizedCurrent) !== null) return max
    const normalizedMax = _normalizeVersion(max)
    return semver.gt(normalizedCurrent, normalizedMax) ? current : max
  }, versions[0])
}

function extractDate(dateAndTime) {
  if (!dateAndTime) return null
  return moment(dateAndTime).format('YYYY-MM-DD')
}

function setIfValue(target, path, value) {
  if (!value) return
  if (Array.isArray(value) && value.length === 0) return
  set(target, path, value)
}

function setToArray(values) {
  const result = Array.from(values)
    .filter(e => e)
    .sort()
  return result.length === 0 ? null : result
}

function addArrayToSet(array, set, valueExtractor) {
  if (!array || !array.length) return set
  valueExtractor = valueExtractor || (value => value)
  for (let entry of array) set.add(valueExtractor(entry))
  return set
}

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

// merge the given definition onto the base definition. Be careful to handle various arrays
// correctly by finding matching entried and merging them as appropriate.
function mergeDefinitions(base, proposed) {
  if (!proposed) return
  if (!base) return proposed
  setIfValue(base, 'described', _mergeDescribed(base.described, proposed.described))
  setIfValue(base, 'licensed', _mergeLicensed(base.licensed, proposed.licensed))
  setIfValue(base, 'files', _mergeFiles(base.files, proposed.files))
}

function _mergeFiles(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  proposed.forEach(file => {
    const entry = find(base, current => current.path === file.path)
    if (entry) _mergeFile(entry, file)
    else base.push(file)
  })
  return base
}

function _mergeFile(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['license', 'attributions', 'facets', 'hashes', 'natures'])
  setIfValue(result, 'license', _mergeLicense(base.license, proposed.license))
  setIfValue(result, 'attributions', _mergeArray(base.attributions, proposed.attributions))
  setIfValue(result, 'facets', _mergeArray(base.facets, proposed.facets))
  setIfValue(result, 'hashes', _mergeObject(base.hashes, proposed.hashes))
  setIfValue(result, 'natures', _mergeArray(base.natures, proposed.natures))
  return result
}

function _mergeDescribed(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['facets', 'hashes'])
  setIfValue(result, 'facets', _mergeObject(base.facets, proposed.facets))
  setIfValue(result, 'hashes', _mergeObject(base.hashes, proposed.hashes))
  return result
}

// Most of the data in the licensed property is computed from the file list data.
// Just merge the declared license
function _mergeLicensed(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['declared'])
  setIfValue(result, 'declared', _mergeLicense(base.declared, proposed.declared))
  return result
}

function _mergeLicense(base, proposed) {
  return !proposed || proposed === 'NOASSERTION' ? base : proposed
}

function _mergeObject(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  return extend(base, proposed)
}

function _mergeArray(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  return union(base, proposed)
}

function _mergeExcept(base, proposed, paths = []) {
  const overlay = {}
  extend(true, overlay, proposed)
  paths.forEach(path => unset(overlay, path))
  extend(true, base, overlay)
  return base
}

function buildSourceUrl(spec) {
  // TODO for now throw away any URL that might be there already due to variances in quality of the data
  // We only support two source providers so anything else is likely bogus.
  switch (spec.provider) {
    case 'github':
      return `https://github.com/${spec.namespace}/${spec.name}/tree/${spec.revision}`
    case 'mavencentral': {
      const fullName = `${spec.namespace}/${spec.name}`.replace(/\./g, '/')
      return `https://search.maven.org/remotecontent?filepath=${fullName}/${spec.revision}/${spec.name}-${
        spec.revision
      }-sources.jar`
    }
    default:
      return null
  }
}

// migrate the format of the source location to the current norm
function updateSourceLocation(spec) {
  // if there is a name then this is the new style source location so just use it
  if (spec.name) return

  if (spec.provider === 'github') {
    const segments = spec.url.split('/')
    spec.namespace = segments[3]
    spec.name = segments[4]
  }

  if (spec.provider === 'mavencentral') {
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
 * @param {EntityCoordinates} coordinates - optional to look deeper than the root based on coordinate type
 * @returns {boolean}
 */
function isLicenseFile(filePath, coordinates) {
  if (!filePath) return false
  filePath = filePath.toLowerCase()
  const basePath = filePath.split('/')[0]
  if (_licenseFileNames.includes(basePath)) return true
  if (!coordinates) return false
  for (const prefix of _licenseLocations[coordinates.type] || []) {
    if (_licenseFileNames.includes(filePath.replace(prefix, ''))) return true
  }
  return false
}

function _normalizeVersion(version) {
  if (version == '1') return '1.0.0' // version '1' is not semver valid see https://github.com/clearlydefined/crawler/issues/124
  return semver.valid(version) ? version : null
}

const _licenseFileNames = [
  'license',
  'license.txt',
  'license.md',
  'license.html',
  'license-mit',
  'license-mit.txt',
  'license-mit.md',
  'license-mit.html',
  'license-apache',
  'license-apache.txt',
  'license-apache.md',
  'license-apache.html'
]
const _licenseLocations = { npm: ['package/'], maven: ['meta-inf/'] }

const _licenseUrlOverrides = [
  {
    test: /^\w*https?:\/\/(?:www.)?opensource.org\/licenses\/mit-license(\.php)?$/i,
    license: 'MIT'
  },
  {
    test: /^\w*https?:\/\/(?:www.)?opensource.org\/licenses\/(.*?)(\.php|\.txt)?$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*http(s)?:\/\/(www.)?apache.org\/licenses\/LICENSE-2\.0(.html|.txt)?$/i,
    license: 'Apache-2.0'
  },
  {
    test: /^\w*https?:\/\/(?:www.)?gnu.org\/licenses\/(.*?)(\.html)?$/i,
    licenseMatchGroup: 1
  },
  {
    test: /^\w*https?:\/\/(?:www.)?licenses.nuget.org\/(.*?)$/i,
    licenseMatchGroup: 1
  }
]

module.exports = {
  toEntityCoordinatesFromRequest,
  toResultCoordinatesFromRequest,
  getLatestVersion,
  extractDate,
  setIfValue,
  setToArray,
  addArrayToSet,
  extractLicenseFromLicenseUrl,
  mergeDefinitions,
  buildSourceUrl,
  updateSourceLocation,
  isLicenseFile
}
