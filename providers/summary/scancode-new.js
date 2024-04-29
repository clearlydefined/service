// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, flatten, uniq } = require('lodash')
const SPDX = require('@clearlydefined/spdx')
const {
  extractDate,
  isDeclaredLicense,
  getLicenseLocations,
  isLicenseFile,
  setIfValue,
  joinExpressions,
  normalizeLicenseExpression
} = require('../../lib/utils')
const logger = require('../logging/logger')

class ScanCodeSummarizerNew {
  constructor(options) {
    this.options = options
    this.logger = logger()
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {*} harvestedData - the set of raw tool outputs related to the identified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvestedData) {
    const scancodeVersion =
      get(harvestedData, 'content.headers[0].tool_version') || get(harvestedData, 'content.scancode_version')

    if (!scancodeVersion) throw new Error('Not valid ScanCode data')

    const result = {}
    this.addDescribedInfo(result, harvestedData)

    let declaredLicense = this._getDeclaredLicense(harvestedData)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._getDeclaredLicenseFromFiles(harvestedData, coordinates) || declaredLicense
    }
    setIfValue(result, 'licensed.declared', declaredLicense)

    result.files = this._summarizeFileInfo(harvestedData.content.files, coordinates)

    return result
  }

  addDescribedInfo(result, harvestedData) {
    const releaseDate = harvestedData._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  _getDeclaredLicense(harvestedData) {
    const licenseReaders = [
      this._readDeclaredLicenseExpressionFromSummary.bind(this),
      this._readDeclaredLicenseExpressionFromPackage.bind(this),
      this._readExtractedLicenseStatementFromPackage.bind(this)
    ]

    for (const reader of licenseReaders) {
      const declaredLicense = reader(harvestedData)
      if (isDeclaredLicense(declaredLicense)) {
        return declaredLicense
      }
    }

    return null
  }

  _readDeclaredLicenseExpressionFromSummary({ content }) {
    const licenseExpression = get(content, 'summary.declared_license_expression')
    const result = licenseExpression && normalizeLicenseExpression(licenseExpression, this.logger)

    return result?.includes('NOASSERTION') ? null : result
  }

  _readDeclaredLicenseExpressionFromPackage({ content }) {
    const { packages } = content
    if (!packages) return null
    const [firstPackage] = packages
    if (!firstPackage) return null

    const licenseExpression =
      firstPackage.declared_license_expression_spdx ||
      normalizeLicenseExpression(firstPackage.declared_license_expression, this.logger)

    return licenseExpression?.includes('NOASSERTION') ? null : licenseExpression
  }

  _readExtractedLicenseStatementFromPackage({ content }) {
    const declared_license = get(content, 'packages[0].extracted_license_statement')
    return SPDX.normalize(declared_license)
  }

  // find and return the files that should be considered for as a license determinator for this summarization
  _getRootFiles(coordinates, files, packages) {
    const roots = getLicenseLocations(coordinates, packages) || []
    roots.push('') // for no prefix
    let rootFiles = this._findRootFiles(files, roots)
    //Some components (e.g. composer/packgist) are packaged under one directory
    if (rootFiles.length === 1 && rootFiles[0].type === 'directory') {
      rootFiles = this._findRootFiles(files, [`${rootFiles[0].path}/`])
    }
    return rootFiles
  }

  _findRootFiles(files, roots) {
    return files.filter(file => {
      for (let root of roots) {
        if (file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1) return true
      }
    })
  }

  _getDeclaredLicenseFromFiles(harvestedData, coordinates) {
    const rootFiles = this._getRootFiles(coordinates, harvestedData.content.files, harvestedData.content.packages)
    return this._getLicensesFromLicenseDetections(rootFiles)
  }

  _getLicensesFromLicenseDetections(files) {
    const fullLicenses = files
      .filter(file => file.percentage_of_license_text >= 90 && file.detected_license_expression_spdx)
      .map(file => file.detected_license_expression_spdx)
    return joinExpressions(fullLicenses)
  }

  _getLicenseByFileName(files, coordinates, licenseClarityScoreThreshold = 90) {
    const fullLicenses = files
      .filter(file => isLicenseFile(file.path, coordinates) && file.license_detections)
      .reduce((licenses, file) => {
        file.license_detections.forEach(licenseDetection => {
          if (licenseDetection.license_expression) {
            licenses.add(normalizeLicenseExpression(licenseDetection.license_expression, this.logger))
            return
          }
          licenseDetection.matches.forEach(match => {
            if (match.score >= licenseClarityScoreThreshold) {
              licenses.add(normalizeLicenseExpression(match.license_expression, this.logger))
            }
          })
        })
        return licenses
      }, new Set())
    return joinExpressions(fullLicenses)
  }

  _summarizeFileInfo(files, coordinates) {
    return files
      .map(file => {
        if (file.type !== 'file') return null

        const result = { path: file.path }

        const licenseExpression =
          file.detected_license_expression_spdx || this._getLicenseByFileName([file], coordinates, 80)
        setIfValue(result, 'license', licenseExpression)

        if (this._getLicensesFromLicenseDetections([file]) || this._getLicenseByFileName([file], coordinates)) {
          result.natures = result.natures || []
          if (!result.natures.includes('license')) result.natures.push('license')
        }

        setIfValue(
          result,
          'attributions',
          file.copyrights
            ? uniq(flatten(file.copyrights.map(c => c.copyright || c.statements || c.value))).filter(x => x)
            : null
        )
        setIfValue(result, 'hashes.sha1', file.sha1)
        setIfValue(result, 'hashes.sha256', file.sha256)

        return result
      })
      .filter(e => e)
  }
}

module.exports = options => new ScanCodeSummarizerNew(options)
