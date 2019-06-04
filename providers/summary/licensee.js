// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { setIfValue, isDeclaredLicense, isLicenseFile } = require('../../lib/utils')
const SPDX = require('@clearlydefined/spdx')
const { get, uniq } = require('lodash')

class LicenseeSummarizer {
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param {EntitySpec} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool ouptuts related to the idenified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    if (!harvested || !harvested.licensee || !harvested.licensee.version) throw new Error('Invalid Licensee data')
    const result = {}
    setIfValue(result, 'files', this._summarizeFiles(harvested))
    this._addLicenseFromFiles(result, coordinates)
    return result
  }

  _summarizeFiles(harvested) {
    const files = get(harvested, 'licensee.output.content.matched_files')
    const attachments = harvested.attachments || []
    if (!files) return null
    return files
      .map(file => {
        if (get(file, 'matcher.name') !== 'exact') return null
        if (80 > +get(file, 'matcher.confidence')) return null
        const path = file.filename
        const attachment = attachments.find(x => x.path === path)
        const license = SPDX.normalize(file.matched_license)
        if (path && isDeclaredLicense(license)) {
          const resultFile = { path, license, natures: ['license'] }
          setIfValue(resultFile, 'token', get(attachment, 'token'))
          return resultFile
        }
      })
      .filter(e => e)
  }

  _addLicenseFromFiles(result, coordinates) {
    if (!result.files) return
    const licenses = result.files
      .map(file => (isDeclaredLicense(file.license) && isLicenseFile(file.path, coordinates) ? file.license : null))
      .filter(x => x)
    setIfValue(result, 'licensed.declared', uniq(licenses).join(' AND '))
  }
}

module.exports = options => new LicenseeSummarizer(options)
