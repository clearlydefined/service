// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const semver = require('semver')
const he = require('he')
const EntityCoordinates = require('./entityCoordinates')
const ResultCoordinates = require('./resultCoordinates')
const { DateTime } = require('luxon')
const { set, unset, union, sortBy, trim, uniqBy } = require('lodash')
const extend = require('extend')
const SPDX = require('@clearlydefined/spdx')
const coordinatesMapper = require('./coordinatesMapper')()


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

async function toNormalizedEntityCoordinates(spec) {
  const coordinates = EntityCoordinates.fromObject(spec)
  return await coordinatesMapper.map(coordinates)
}

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
function reEncodeSlashes(namespace) {
  return `${namespace.replace(/\//g, '%2f')}`
}

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

function simplifyAttributions(entries) {
  if (!entries || !entries.length) return null
  // first decode any HTML and reduce whitespace
  // trim off all non-pair punctuation and sort longest first (favor longer entries).
  // unique the collection ignoring common, legit trailing punctuation.
  // return the elements in more or less the same order they arrived
  // TODO that last part about ordering is less than optimal right now.
  // TODO remove whitespace after/before pair punctuation (e.g., < this@that.com >)
  const decoded = entries.map(entry =>
    he
      .decode(entry)
      .replace(/(\\[nr]|[\n\r])/g, ' ')
      .replace(/ +/g, ' ')
  )
  const trimmed = decoded.map(entry => trim(entry, ' ~!@#$%^&*_-=+|:;?/,'))
  const sorted = sortBy(trimmed, 'length').reverse()
  return uniqBy(sorted, value => trim(value, '.')).reverse()
}

function utcDateTime(dateAndTime) {
  const utcOpt = { zone: 'utc' }
  let result = DateTime.fromISO(dateAndTime, utcOpt)
  if (!result.isValid) {
    //fromISO includes parsing pattern 'yyyy-MM-dd' (https://moment.github.io/luxon/#/parsing?id=iso-8601)
    result = DateTime.fromFormat(dateAndTime, 'MM-dd-yyyy', utcOpt)
  }
  return result.isValid ? result : null
}

function extractDate(dateAndTime) {
  if (!dateAndTime) return null
  const result = utcDateTime(dateAndTime)
  if (!result) return null
  const instant = result.until(result)
  const validStart = utcDateTime('1950-01-01')
  const validEnd = DateTime.utc().plus(30, 'days')
  if (instant.isBefore(validStart) || instant.isAfter(validEnd)) return null
  return result.toISODate() //'yyyy-MM-dd' format
}

function compareDates(dateA, dateB) {
  if (!dateA || !dateB) return dateA ? 1 : (dateB ? -1 : 0)
  return DateTime.fromISO(dateA).toJSDate() - DateTime.fromISO(dateB).toJSDate()
}

function setIfValue(target, path, value) {
  if (!value) return false
  if (Array.isArray(value) && value.length === 0) return false
  set(target, path, value)
  return true
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
// correctly by finding matching entries and merging them as appropriate.
function mergeDefinitions(base, proposed, override) {
  if (!proposed) return
  if (!base) return proposed
  setIfValue(base, 'described', _mergeDescribed(base.described, proposed.described))
  setIfValue(base, 'licensed', _mergeLicensed(base.licensed, proposed.licensed, override))
  setIfValue(base, 'files', _mergeFiles(base.files, proposed.files, override))
}

function _mergeFiles(base, proposed, override) {
  if (!proposed) return base
  if (!base) return proposed
  const baseLookup = base.reduce((result, item) => {
    result[item.path] = item
    return result
  }, {})
  proposed.forEach(file => {
    const entry = baseLookup[file.path]
    if (entry) _mergeFile(entry, file, override)
    else base.push(file)
  })
  return base
}

function _mergeFile(base, proposed, override) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['license', 'attributions', 'facets', 'hashes', 'natures'])
  const overrideStrategy = override ? proposed => proposed : (proposed, mergeStrategy) => mergeStrategy(proposed)
  setIfValue(result, 'license', overrideStrategy(proposed.license, p => SPDX.merge(p, base.license, 'AND')))
  setIfValue(result, 'attributions', overrideStrategy(proposed.attributions, p => _mergeArray(base.attributions, p)))
  setIfValue(result, 'facets', overrideStrategy(proposed.facets, p => _mergeArray(base.facets, p)))
  setIfValue(result, 'hashes', overrideStrategy(proposed.hashes, p => _mergeObject(base.hashes, p)))
  setIfValue(result, 'natures', overrideStrategy(proposed.natures, p => _mergeArray(base.natures, p)))
  return result
}

function _mergeDescribed(base, proposed) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['facets', 'hashes', 'files'])
  setIfValue(result, 'facets', _mergeObject(base.facets, proposed.facets))
  setIfValue(result, 'hashes', _mergeObject(base.hashes, proposed.hashes))
  setIfValue(result, 'files', Math.max(base.files || 0, proposed.files || 0))
  return result
}

// Most of the data in the licensed property is computed from the file list data.
// Just merge the declared license
function _mergeLicensed(base, proposed, override) {
  if (!proposed) return base
  if (!base) return proposed
  const result = _mergeExcept(base, proposed, ['declared'])
  setIfValue(result, 'declared', override ? proposed.declared : SPDX.merge(proposed.declared, base.declared, 'AND'))
  return result
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
      return `https://pkg.go.dev/${deCodeSlashes(spec.namespace)}/${spec.name}@${spec.revision}`
    }
    case 'pypi': {
      return `https://pypi.org/project/${spec.name}/${spec.revision}/`
    }
    default:
      return null
  }
}

function deCodeSlashes(namespace) {
  return `${namespace.replace(/%2f/g, '/')}`
}

// migrate the format of the source location to the current norm
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
 * @param {EntityCoordinates} coordinates - optional to look deeper than the root based on coordinate type
 * @returns {boolean}
 */
function isLicenseFile(filePath, coordinates) {
  if (!filePath) return false
  filePath = filePath.toLowerCase()
  const basePath = filePath.split('/')[0]
  if (_licenseFileNames.includes(basePath)) return true
  if (!coordinates) return false
  for (const prefix of getLicenseLocations(coordinates) || []) {
    if (_licenseFileNames.includes(filePath.replace(prefix, ''))) return true
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

function getLicenseLocations(coordinates) {
  const map = { npm: ['package/'], maven: ['meta-inf/'], pypi: [`${coordinates.name}-${coordinates.revision}/`], go: [goLicenseLocations(coordinates)] }
  return map[coordinates.type]
}

function goLicenseLocations(coordinates) {
  if (coordinates.namespace && coordinates.namespace.includes('%2f')) {
    return `${deCodeSlashes(coordinates.namespace)}/${coordinates.name}@${coordinates.revision}/`
  } else {
    return `${coordinates.namespace}/${coordinates.name}@${coordinates.revision}/`
  }
}

function _normalizeVersion(version) {
  if (version == '1') return '1.0.0' // version '1' is not semver valid see https://github.com/clearlydefined/crawler/issues/124
  return semver.valid(version) ? version : null
}

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
  'license-apache.html',
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
  { test: /^https?:\/\/aka.ms\/azureml-sdk-license/i, license: 'OTHER' }
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
