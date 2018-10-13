// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, set, isArray, uniq } = require('lodash')
const {
  extractDate,
  setIfValue,
  extractLicenseFromLicenseUrl,
  buildSourceUrl,
  updateSourceLocation,
  isLicenseFile
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
    setIfValue(result, 'files', data.interestingFiles)
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

  addSourceArchiveData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
  }

  addNuGetData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'licensed.declared', extractLicenseFromLicenseUrl(get(data, 'manifest.licenseUrl')))
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
    const license = manifest.license
    license && setIfValue(result, 'licensed', { declared: typeof license === 'string' ? license : license.type })
  }

  addGemData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'licensed.declared', data.licenses)
  }

  addPyPiData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'licensed.declared', data.declaredLicense)
  }
}

module.exports = options => new ClearlyDescribedSummarizer(options)
