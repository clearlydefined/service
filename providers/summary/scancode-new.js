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
  setToArray
} = require('../../lib/utils')
const logger = require('../logging/logger')
const scancodeMap = require('../../lib/scancodeMap')

class ScanCodeSummarizerNew {
  constructor(options) {
    this.options = options
    this.logger = logger()
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool outputs related to the identified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    const scancodeVersion =
      get(harvested, 'content.headers[0].tool_version') || get(harvested, 'content.scancode_version')

    if (!scancodeVersion) throw new Error('Not valid ScanCode data')
    
    const result = {}
    this.addDescribedInfo(result, harvested)
    
    let declaredLicense = this._getDeclaredLicense(harvested)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._getDeclaredLicenseFromFiles(harvested, coordinates) || declaredLicense
    }
    setIfValue(result, 'licensed.declared', declaredLicense)
    
    result.files = this._summarizeFileInfo(scancodeVersion, harvested.content.files, coordinates)
    
    return result
  }

  addDescribedInfo(result, harvested) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  _getDeclaredLicense(harvested) {
    const licenseReaders = [
      this._readDeclaredLicenseExpressionFromSummary.bind(this),
      this._readDeclaredLicenseExpressionFromPackage.bind(this),
      this._readExtractedLicenseStatementFromPackage.bind(this)
    ]

    for (const reader of licenseReaders) {
      const declaredLicense = reader(harvested)
      if (isDeclaredLicense(declaredLicense)) {
        return declaredLicense
      }
    }

    return null
  }

  _readDeclaredLicenseExpressionFromSummary({ content }) {
    const licenseExpression = get(content, 'summary.declared_license_expression')
    const result = licenseExpression && this._normalizeLicenseExpression(licenseExpression)

    return result?.includes('NOASSERTION') ? null : result
  }

  _readDeclaredLicenseExpressionFromPackage({ content }) {
    const { packages } = content
    if (!packages) return null
    const [firstPackage] = packages
    if (!firstPackage) return null

    const licenseExpression = firstPackage.declared_license_expression_spdx
      || this._normalizeLicenseExpression(firstPackage.declared_license_expression)

    return licenseExpression?.includes('NOASSERTION') ? null : licenseExpression
  }

  _readExtractedLicenseStatementFromPackage({ content }) {
    const declared_license = get(content, 'packages[0].extracted_license_statement')
    return SPDX.normalize(declared_license)
  }

  // find and return the files that should be considered for as a license determinator for this summarization
  _getRootFiles(coordinates, files) {
    const roots = getLicenseLocations(coordinates) || []
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

  _getDeclaredLicenseFromFiles(harvested, coordinates) {
    const rootFile = this._getRootFiles(coordinates, harvested.content.files)
    return this._getLicenseFromLicenseDetections(rootFile)
  }

  _getLicenseFromLicenseDetections(files) {
    const fullLicenses = files
      .filter(file => (file.percentage_of_license_text >= 80 && file.license_detections))
      .reduce((licenses, file) => {
        file.license_detections.forEach(licenseDetection => {
          licenses.add(this._normalizeLicenseExpression(licenseDetection.license_expression))
        })
        return licenses
      }, new Set())
    return this._joinExpressions(fullLicenses)
  }

  _getLicenseByFileName(files, coordinates) {
    const fullLicenses = files
    // TODO: Update, file no longer has licenses property
      .filter(file => isLicenseFile(file.path, coordinates) && file.licenses)
      .reduce((licenses, file) => {
        file.licenses.forEach(license => {
          if (license.score >= 90) licenses.add(this._createExpressionFromLicense(license))
        })
        return licenses
      }, new Set())
    return this._joinExpressions(fullLicenses)
  }

  _summarizeFileInfo(scancodeVersion, files, coordinates) {
    return files
      .map(file => {
        if (file.type !== 'file') return null

        const result = { path: file.path }

        const licenseExpression = file.detected_license_expression_spdx
        || this._normalizeLicenseExpression(file.detected_license_expression)
        setIfValue(result, 'license', licenseExpression)
        
        if (this._getLicenseFromLicenseDetections([file]) || this._getLicenseByFileName([file], coordinates)) {
          result.natures = result.natures || []
          if (!result.natures.includes('license')) result.natures.push('license')
        }

        setIfValue(
          result,
          'attributions',
          file.copyrights ? uniq(flatten(file.copyrights.map(c => c.copyright || c.statements || c.value))).filter(x => x) : null
        )
        setIfValue(result, 'hashes.sha1', file.sha1)
        setIfValue(result, 'hashes.sha256', file.sha256)

        return result
      })
      .filter(e => e)
  }

  _joinExpressions(expressions) {
    if (!expressions) return null
    const list = setToArray(expressions)
    if (!list) return null
    return list.join(' AND ')
  }

  _createExpressionFromLicense(license) {
    const rule = license.matched_rule
    if (!rule || !rule.license_expression) return SPDX.normalize(license.spdx_license_key)
    return this._normalizeLicenseExpression(rule.license_expression)
  }

  _normalizeLicenseExpression(licenseExpression) {
    if (!licenseExpression) return null

    const parsed = SPDX.parse(licenseExpression || '', (key) => SPDX.normalizeSingle(scancodeMap.get(key) || key))
    const result = SPDX.stringify(parsed)

    if (result === 'NOASSERTION') this.logger.info(`ScanCode NOASSERTION from ${licenseExpression}`)
    
    return result
  }
}

module.exports = options => new ScanCodeSummarizerNew(options)