// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { pick, set } = require('lodash')
const { extractDate, setIfValue } = require('../../lib/utils')

class ClearlyDescribedSummarizer {
  constructor(options) {
    this.options = options
  }

  summarize(coordinates, data, filter = null) {
    const result = { described: {} }
    this.addFacetInfo(result, data)
    if (!filter)
      // if just getting facets, we're done
      return result
    this.addSourceLocation(result, data, filter)
    switch (coordinates.type) {
      case 'npm':
        this.addNpmData(result, data, filter)
        break
      case 'maven':
        this.addMavenData(result, data, filter)
        break
      case 'sourcearchive':
        this.addSourceArchiveData(result, data, filter)
        break
      case 'nuget':
        this.addNuGetData(result, data, filter)
        break
      case 'gem':
        this.addGemData(result, data, filter)
        break
      case 'pypi':
        this.addPyPiData(result, data, filter)
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

  addMavenData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
  }

  addSourceArchiveData(result, data) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
  }

  addNuGetData(result, data) {
    setIfValue(result, 'described.releaseDate', data.releaseDate)
  }

  addNpmData(result, data) {
    setIfValue(result, 'described.projectWebsite', data.registryData.manifest.homepage)
    const bugs = data.registryData.manifest.bugs
    bugs && setIfValue(result, 'described.issueTracker', bugs.url || bugs.email)
    setIfValue(result, 'described.releaseDate', extractDate(data.registryData.releaseDate))
    const license = data.registryData.manifest.license
    license && setIfValue(result, 'licensed', { declared: typeof license === 'string' ? license : license.type })
  }

  addGemData(result, data) {
    setIfValue(result, 'described.releaseDate', data.releaseDate)
    setIfValue(result, 'licensed.declared', data.licenses)
  }

  addPyPiData(result, data) {
    setIfValue(result, 'described.releaseDate', data.releaseDate)
    setIfValue(result, 'licensed.declared', data.declaredLicense)
  }
}

module.exports = options => new ClearlyDescribedSummarizer(options)
