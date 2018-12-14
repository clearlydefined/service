// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, flatten, uniq } = require('lodash')
const SPDX = require('../../lib/spdx')
const { extractDate, setIfValue, addArrayToSet, setToArray, isLicenseFile } = require('../../lib/utils')
const logger = require('../logging/logger')
const scanodeMap = require('../../lib/scancodeMap')

class ScanCodeSummarizer {
  constructor(options) {
    this.options = options
    this.logger = logger()
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntitySpec} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool ouptuts related to the idenified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    if (!harvested || !harvested.content || !harvested.content.scancode_version)
      throw new Error('Not valid ScanCode data')
    const result = {}
    this.addDescribedInfo(result, harvested)
    const declaredLicense =
      this._summarizeDeclaredLicenseInfo(harvested.content.files, coordinates) ||
      this._summarizePackageInfo(harvested.content.files)
    setIfValue(result, 'licensed.declared', declaredLicense)
    result.files = this._summarizeFileInfo(harvested.content.files)
    return result
  }

  addDescribedInfo(result, harvested) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  _summarizeDeclaredLicenseInfo(files, coordinates) {
    for (let file of files) {
      if (isLicenseFile(file.path, coordinates) && file.licenses) {
        // Find the first license file and treat it as the authority
        const declaredLicenses = new Set(
          file.licenses
            .filter(x => x.score >= 80)
            .map(license => this._createExpressionFromRule(license.matched_rule, license.spdx_license_key))
        )
        if (declaredLicenses.size) return this._joinExpressions(declaredLicenses)
      }
    }
    return null
  }

  _summarizePackageInfo(files) {
    for (let file of files) {
      const asserted = get(file, 'packages[0].asserted_licenses')
      // Find the first package file and treat it as the authority
      if (asserted) {
        const packageLicenses = addArrayToSet(
          asserted,
          new Set(),
          license => license.license || license.spdx_license_key
        )
        return this._joinExpressions(packageLicenses)
      }
    }
    return null
  }

  _summarizeFileInfo(files) {
    return files
      .map(file => {
        if (file.type !== 'file') return null
        const asserted = get(file, 'packages[0].asserted_licenses')
        const fileLicense = asserted || file.licenses
        let licenses = new Set(fileLicense.map(x => x.license).filter(x => x))
        if (!licenses.size) {
          licenses = new Set(
            fileLicense
              .filter(x => x.score >= 80)
              .map(license => this._createExpressionFromRule(license.matched_rule, license.spdx_license_key))
          )
        }
        const licenseExpression = this._joinExpressions(licenses)
        const result = { path: file.path }
        setIfValue(result, 'license', licenseExpression)
        setIfValue(
          result,
          'attributions',
          file.copyrights ? uniq(flatten(file.copyrights.map(c => c.statements))) : null
        )
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

  _createExpressionFromRule(rule, licenseKey) {
    if (!rule || !rule.license_expression) return SPDX.normalize(licenseKey)
    const parsed = SPDX.parse(rule.license_expression, key => SPDX.normalizeSingle(scanodeMap.get(key) || key))
    const result = SPDX.stringify(parsed)
    if (result === 'NOASSERTION') this.logger.info(`ScanCode NOASSERTION from ${rule.license_expression}`)
    return result
  }
}

module.exports = options => new ScanCodeSummarizer(options)
