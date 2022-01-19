// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, flatten, uniq } = require('lodash')
const SPDX = require('@clearlydefined/spdx')
const {
  extractDate,
  getLicenseLocations,
  isLicenseFile,
  setIfValue,
  addArrayToSet,
  setToArray
} = require('../../lib/utils')
const logger = require('../logging/logger')
const scancodeMap = require('../../lib/scancodeMap')

class ScanCodeSummarizer {
  constructor(options) {
    this.options = options
    this.logger = logger()
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntitySpec} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool outputs related to the identified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    const scancodeVersion =
      get(harvested, 'content.headers[0].tool_version') || get(harvested, 'content.scancode_version')
    if (!scancodeVersion) throw new Error('Not valid ScanCode data')
    const result = {}
    this.addDescribedInfo(result, harvested)
    // For Rust crates, leave the license declaration to the ClearlyDefined summarizer which parses Cargo.toml
    if (get(coordinates, 'type') !== 'crate') {
      const declaredLicense =
        this._readDeclaredLicense(harvested) || this._getDeclaredLicense(scancodeVersion, harvested, coordinates)
      setIfValue(result, 'licensed.declared', declaredLicense)
    }
    result.files = this._summarizeFileInfo(harvested.content.files, coordinates)
    return result
  }

  addDescribedInfo(result, harvested) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  _readDeclaredLicense(harvested) {
    const declared = get(harvested, 'content.summary.packages[0].declared_license')
    return SPDX.normalize(declared)
  }

  // find and return the files that should be considered for as a license determinator for this summarization
  _getRootFiles(coordinates, files) {
    const roots = getLicenseLocations(coordinates) || []
    roots.push('') // for no prefix
    return files.filter(file => {
      for (let root of roots)
        if (file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1) return true
    })
  }

  _getDeclaredLicense(scancodeVersion, harvested, coordinates) {
    const rootFile = this._getRootFiles(coordinates, harvested.content.files)
    switch (scancodeVersion) {
      case '2.2.1':
        return this._getLicenseByPackageAssertion(rootFile)
      case '2.9.2':
      case '2.9.8':
        return this._getLicenseByFileName(rootFile, coordinates)
      case '3.0.0':
      case '3.0.2':
        return this._getLicenseByIsLicenseText(rootFile)
      default:
        return null
    }
  }

  _getLicenseByIsLicenseText(files) {
    const fullLicenses = files
      .filter(file => file.is_license_text && file.licenses)
      .reduce((licenses, file) => {
        file.licenses.forEach(license => {
          licenses.add(this._createExpressionFromLicense(license))
        })
        return licenses
      }, new Set())
    return this._joinExpressions(fullLicenses)
  }

  _getLicenseByFileName(files, coordinates) {
    const fullLicenses = files
      .filter(file => isLicenseFile(file.path, coordinates) && file.licenses)
      .reduce((licenses, file) => {
        file.licenses.forEach(license => {
          if (license.score >= 90) licenses.add(this._createExpressionFromLicense(license))
        })
        return licenses
      }, new Set())
    return this._joinExpressions(fullLicenses)
  }

  // Create a license expression from all of the package info in the output
  _getLicenseByPackageAssertion(files) {
    for (let file of files) {
      const asserted = get(file, 'packages[0].asserted_licenses')
      // Find the first package file and treat it as the authority
      if (asserted) {
        const packageLicenses = addArrayToSet(
          asserted,
          new Set(),
          // TODO, is `license.license` real?
          license => license.license || license.spdx_license_key
        )
        return this._joinExpressions(packageLicenses)
      }
    }
    return null
  }

  _summarizeFileInfo(files, coordinates) {
    return files
      .map(file => {
        if (file.type !== 'file') return null
        const result = { path: file.path }
        const asserted = get(file, 'packages[0].asserted_licenses')
        const fileLicense = asserted || file.licenses || []
        let licenses = new Set(fileLicense.map(x => x.license).filter(x => x))
        if (!licenses.size)
          licenses = new Set(fileLicense.filter(x => x.score >= 80).map(x => this._createExpressionFromLicense(x)))
        const licenseExpression = this._joinExpressions(licenses)
        setIfValue(result, 'license', licenseExpression)
        if (this._getLicenseByIsLicenseText([file]) || this._getLicenseByFileName([file], coordinates)) {
          result.natures = result.natures || []
          if (!result.natures.includes('license')) result.natures.push('license')
        }
        setIfValue(
          result,
          'attributions',
          file.copyrights ? uniq(flatten(file.copyrights.map(c => c.statements || c.value))).filter(x => x) : null
        )
        setIfValue(result, 'hashes.sha1', file.sha1)
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
    const parsed = SPDX.parse(rule.license_expression, key => SPDX.normalizeSingle(scancodeMap.get(key) || key))
    const result = SPDX.stringify(parsed)
    if (result === 'NOASSERTION') this.logger.info(`ScanCode NOASSERTION from ${rule.license_expression}`)
    return result
  }
}

module.exports = options => new ScanCodeSummarizer(options)
