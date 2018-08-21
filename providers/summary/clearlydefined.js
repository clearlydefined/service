// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { pick, get } = require('lodash')
const { extractDate, setIfValue, extractLicenseFromLicenseUrl } = require('../../lib/utils')

class ClearlyDescribedSummarizer {
  constructor(options) {
    this.options = options
  }

  summarize(coordinates, data) {
    const result = {}
    this.addFacetInfo(result, data)
    this.addSourceLocation(result, data)
    this.addInterestingFiles(result, data)
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
    setIfValue(
      result,
      'described.sourceLocation',
      pick(data.sourceInfo, ['type', 'provider', 'url', 'revision', 'path'])
    )
  }

  addInterestingFiles(result, data) {
    setIfValue(result, 'files', data.interestingFiles)
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
    setIfValue(result, 'described.projectWebsite', manifest.homepage)
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
