// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./index').SummarizerOptions} SummarizerOptions
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./licensee').LicenseeHarvestedData} LicenseeHarvestedData
 * @typedef {import('./licensee').LicenseeSummaryResult} LicenseeSummaryResult
 * @typedef {import('./licensee').LicenseeMatchedFile} LicenseeMatchedFile
 * @typedef {import('../../lib/utils').FileEntry} FileEntry
 */

const { setIfValue, isDeclaredLicense, isLicenseFile } = require('../../lib/utils')
const SPDX = require('@clearlydefined/spdx')
const { get, uniq } = require('lodash')

/**
 * Licensee summarizer class that processes harvested data from the Licensee tool.
 * Extracts license information from matched license files.
 * @class
 */
class LicenseeSummarizer {
  /**
   * Creates a new LicenseeSummarizer instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   */
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {LicenseeHarvestedData} harvested - the set of raw tool outputs related to the identified entity
   * @returns {LicenseeSummaryResult} - a summary of the given raw information
   * @throws {Error} If Licensee data is invalid
   */
  summarize(coordinates, harvested) {
    if (!harvested || !harvested.licensee || !harvested.licensee.version) throw new Error('Invalid Licensee data')
    const result = {}
    setIfValue(result, 'files', this._summarizeFiles(harvested))
    this._addLicenseFromFiles(result, coordinates)
    return result
  }

  /**
   * Summarizes matched files into FileEntry format
   * @param {LicenseeHarvestedData} harvested - The harvested data
   * @returns {FileEntry[] | null} Array of file entries or null
   * @private
   */
  _summarizeFiles(harvested) {
    const files = /** @type {LicenseeMatchedFile[] | undefined} */ (
      get(harvested, 'licensee.output.content.matched_files')
    )
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
          /** @type {FileEntry} */
          const resultFile = { path, license, natures: ['license'] }
          setIfValue(resultFile, 'token', get(attachment, 'token'))
          return resultFile
        }
        return null
      })
      .filter(/** @param {FileEntry | null} e */ e => e !== null)
  }

  /**
   * Adds declared license from license files to the result
   * @param {LicenseeSummaryResult} result - The result object to modify
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @private
   */
  _addLicenseFromFiles(result, coordinates) {
    if (!result.files) return
    const licenses = result.files
      .map(file => (isDeclaredLicense(file.license) && isLicenseFile(file.path, coordinates) ? file.license : null))
      .filter(x => x)
    setIfValue(result, 'licensed.declared', uniq(licenses).join(' AND '))
  }
}

/**
 * Factory function that creates a LicenseeSummarizer instance
 * @param {SummarizerOptions} [options] - Configuration options for the summarizer
 * @returns {LicenseeSummarizer} A new LicenseeSummarizer instance
 */
module.exports = options => new LicenseeSummarizer(options)
