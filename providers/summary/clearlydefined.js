// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, set, isArray, uniq, cloneDeep } = require('lodash')
const SPDX = require('../../lib/spdx')
const {
  extractDate,
  setIfValue,
  extractLicenseFromLicenseUrl,
  buildSourceUrl,
  updateSourceLocation,
  isLicenseFile,
  mergeDefinitions
} = require('../../lib/utils')

class ClearlyDescribedSummarizer {
  constructor(options) {
    this.options = options
  }

  summarize(coordinates, data) {
    const result = {}
    this.addFacetInfo(result, data)
    this.addSourceLocation(result, data)
    this.addInterestingFiles(result, data)
    this.addLicenseFromFiles(result, data, coordinates)
    switch (coordinates.type) {
      case 'npm':
        this.addNpmData(result, data)
        break
      case 'crate':
        this.addCrateData(result, data)
        break
      case 'maven':
        this.addMavenData(result, data)
        break
      case 'sourcearchive':
        this.addSourceArchiveData(result, data)
        break
      case 'nuget':
        this.addNuGetData(result, data)
        break
      case 'gem':
        this.addGemData(result, data)
        break
      case 'pypi':
        this.addPyPiData(result, data)
        break
      default:
    }
    return result
  }

  addFacetInfo(result, data) {
    setIfValue(result, 'described.facets', data.facets)
  }

  addSourceLocation(result, data) {
    if (!data.sourceInfo) return
    const spec = data.sourceInfo
    updateSourceLocation(spec)
    spec.url = buildSourceUrl(spec)
    set(result, 'described.sourceLocation', spec)
  }

  addInterestingFiles(result, data) {
    if (!data.interestingFiles) return
    const newDefinition = cloneDeep(result)
    const newFiles = cloneDeep(data.interestingFiles)
    newFiles.forEach(file => {
      file.license = SPDX.normalize(file.license)
      if (!file.license) delete file.license
    })
    set(newDefinition, 'files', newFiles)
    mergeDefinitions(result, newDefinition)
  }

  addLicenseFromFiles(result, data, coordinates) {
    if (!data.interestingFiles) return
    const licenses = data.interestingFiles
      .map(file => (file.license !== 'NOASSERTION' && isLicenseFile(file.path, coordinates) ? file.license : null))
      .filter(x => x)
    setIfValue(result, 'licensed.declared', uniq(licenses).join(' AND '))
  }

  addMavenData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
  }

  addCrateData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(get(data, 'registryData.created_at')))
    setIfValue(result, 'described.projectWebsite', get(data, 'manifest.homepage'))
    const license = get(data, 'registryData.license')
    if (license) setIfValue(result, 'licensed.declared', SPDX.normalize(license.split('/').join(' OR ')))
  }

  addSourceArchiveData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
  }

  addNuGetData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const licenseExpression = SPDX.normalize(get(data, 'manifest.licenseExpression'))
    const licenseUrl = get(data, 'manifest.licenseUrl')
    if (licenseExpression) set(result, 'licensed.declared', licenseExpression)
    else if (licenseUrl && licenseUrl.trim())
      set(result, 'licensed.declared', extractLicenseFromLicenseUrl(licenseUrl) || 'NOASSERTION')
    const packageEntries = get(data, 'manifest.packageEntries')
    if (!packageEntries) return
    const newDefinition = cloneDeep(result)
    newDefinition.files = packageEntries.map(file => {
      return { path: decodeURIComponent(file.fullName) }
    })
    mergeDefinitions(result, newDefinition)
  }

  addNpmData(result, data) {
    if (!data.registryData) return
    setIfValue(result, 'described.releaseDate', extractDate(data.registryData.releaseDate))
    const manifest = get(data, 'registryData.manifest')
    if (!manifest) return
    let homepage = manifest.homepage
    if (homepage && isArray(homepage)) homepage = homepage[0]
    setIfValue(result, 'described.projectWebsite', homepage)
    const bugs = manifest.bugs
    if (bugs) {
      if (typeof bugs === 'string') {
        if (bugs.startsWith('http')) setIfValue(result, 'described.issueTracker', bugs)
      } else setIfValue(result, 'described.issueTracker', bugs.url || bugs.email)
    }
    const license =
      manifest.license &&
      SPDX.normalize(typeof manifest.license === 'string' ? manifest.license : manifest.license.type)
    setIfValue(result, 'licensed.declared', license)
  }

  addGemData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const license = SPDX.normalize(get(data, 'registryData.license'))
    if (license) set(result, 'licensed.declared', license)
    else {
      const licenses = SPDX.normalize((get(data, 'registryData.licenses') || []).join(' OR '))
      setIfValue(result, 'licensed.declared', licenses)
    }
  }

  addPyPiData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'licensed.declared', data.declaredLicense)
  }
}

module.exports = options => new ClearlyDescribedSummarizer(options)
