// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, flatten, uniq } = require('lodash')
const SPDX = require('../../lib/spdx')
const { extractDate, setIfValue, addArrayToSet, setToArray } = require('../../lib/utils')
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
    const files = this._getRootFiles(coordinates.type, harvested.content.files)
    const declaredLicense = this._summarizePackageInfo(files) || this._summarizeFullLicenses(files)
    setIfValue(result, 'licensed.declared', declaredLicense)
    result.files = this._summarizeFileInfo(harvested.content.files)
    return result
  }

  addDescribedInfo(result, harvested) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  // find and return the files that should be considered for as a license determinator for this summarization
  _getRootFiles(type, files) {
    // TODO allow files in / all the time
    // TODO add maven meta-inf support
    const root = type === 'npm' ? 'package/' : ''
    return files.filter(file => file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1)
  }

  // Create a license expression from all of the actual license texts in the output
  // TODO currently `is_license_text` is really "has full license text". As such it is not any more
  // definitive a statemetent of the component's overall license than a file including an SPDX id.
  // Leaving this in here for now but we need to work with the ScanCode folks to get a more
  // explicit indication of when a file IS the license text. To approximate that, put the score
  // bar up to 100
  _summarizeFullLicenses(files) {
    const fullLicenses = files.reduce((licenses, file) => {
      if (file.licenses)
        file.licenses.forEach(license => {
          if (license.score === 100 && license.matched_rule.is_license_text)
            licenses.add(this._createExpressionFromLicense(license))
        })
      return licenses
    }, new Set())
    return this._joinExpressions(fullLicenses)
  }

  // Create a license expression from all of the package info in the output
  _summarizePackageInfo(files) {
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

  _summarizeFileInfo(files) {
    return files
      .map(file => {
        if (file.type !== 'file') return null
        const result = { path: file.path }
        const asserted = get(file, 'packages[0].asserted_licenses')
        const fileLicense = asserted || file.licenses || []
        let licenses = new Set(fileLicense.map(x => x.license).filter(x => x))
        if (!licenses.size)
          licenses = new Set(fileLicense.filter(x => x.score >= 80).map(this._createExpressionFromLicense))
        const licenseExpression = this._joinExpressions(licenses)
        setIfValue(result, 'license', licenseExpression)
        // TODO see note above re: ScanCode's meaning of `is_license_text` (really has license text). Pump the
        // match score bar to 100 to try and ensure this actually IS the license.
        if (
          file.licenses &&
          file.licenses.some(license => get(license, 'matched_rule.is_license_text') && license.score >= 100)
        ) {
          result.natures = result.natures || []
          if (!result.natures.includes('license')) result.natures.push('license')
        }
        setIfValue(
          result,
          'attributions',
          file.copyrights ? uniq(flatten(file.copyrights.map(c => c.statements))) : null
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
    const parsed = SPDX.parse(rule.license_expression, key => SPDX.normalizeSingle(scanodeMap.get(key) || key))
    const result = SPDX.stringify(parsed)
    if (result === 'NOASSERTION') this.logger.info(`ScanCode NOASSERTION from ${rule.license_expression}`)
    return result
  }
}

module.exports = options => new ScanCodeSummarizer(options)
