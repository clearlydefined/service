// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./index').SummarizerOptions} SummarizerOptions
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./reuse').ReuseHarvestedData} ReuseHarvestedData
 * @typedef {import('./reuse').ReuseSummaryResult} ReuseSummaryResult
 * @typedef {import('./reuse').ReuseFile} ReuseFile
 * @typedef {import('./reuse').ReuseLicense} ReuseLicense
 * @typedef {import('../../lib/utils').FileEntry} FileEntry
 */

const { setIfValue, isDeclaredLicense } = require('../../lib/utils')
const SPDX = require('@clearlydefined/spdx')
const { get, uniq } = require('lodash')

/**
 * FSFE REUSE summarizer class that processes harvested data from the REUSE tool.
 * Extracts license and copyright information following the REUSE specification.
 * @class
 */
class FsfeReuseSummarizer {
  /**
   * Creates a new FsfeReuseSummarizer instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   */
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntityCoordinates} _coordinates - The entity for which we are summarizing
   * @param {ReuseHarvestedData} harvested - the set of raw tool outputs related to the identified entity
   * @returns {ReuseSummaryResult} - a summary of the given raw information
   * @throws {Error} If REUSE data is invalid
   */
  summarize(_coordinates, harvested) {
    if (!harvested || !harvested.reuse || !harvested.reuse.metadata.CreatorTool) throw new Error('Invalid REUSE data')
    const result = {}

    setIfValue(result, 'files', this._summarizeFiles(harvested))
    this._addLicenseDeclaration(harvested, result)
    return result
  }

  /**
   * Summarizes REUSE files into FileEntry format
   * @param {ReuseHarvestedData} harvested - The harvested data
   * @returns {FileEntry[] | null} Array of file entries or null
   * @private
   */
  _summarizeFiles(harvested) {
    const files = /** @type {ReuseFile[] | undefined} */ (get(harvested, 'reuse.files'))
    if (!files) return null
    /** @type {FileEntry[]} */
    const licenseFiles = []
    const attachments = harvested.attachments || []
    const licenses = /** @type {ReuseLicense[] | undefined} */ (get(harvested, 'reuse.licenses'))
    if (licenses) {
      licenses.forEach(license => {
        const licenseSpdxId = SPDX.normalize(license.spdxId)
        if (license.filePath && isDeclaredLicense(licenseSpdxId)) {
          const attachment = attachments.find(x => x.path === license.filePath)
          /** @type {FileEntry} */
          const licenseFile = { path: license.filePath, license: licenseSpdxId, natures: ['license'] }
          setIfValue(licenseFile, 'token', get(attachment, 'token'))
          licenseFiles.push(licenseFile)
        }
      })
    }
    return files
      .map(file => {
        const path = file.FileName
        let declaredLicense = file.LicenseConcluded
        if (!isDeclaredLicense(declaredLicense)) {
          declaredLicense = file.LicenseInfoInFile
        }
        const license = SPDX.normalize(declaredLicense)
        if (path && isDeclaredLicense(license)) {
          /** @type {FileEntry} */
          const resultFile = { path, license, hashes: { sha1: file.FileChecksumSHA1 } }
          if (file.FileCopyrightText && file.FileCopyrightText !== 'NONE') {
            resultFile.attributions = [file.FileCopyrightText]
          }
          return resultFile
        }
        return null
      })
      .concat(licenseFiles)
      .filter(/** @param {FileEntry | null} e */ e => e !== null)
  }

  /**
   * Adds declared license from REUSE licenses to the result
   * @param {ReuseHarvestedData} harvested - The harvested data
   * @param {ReuseSummaryResult} result - The result object to modify
   * @private
   */
  _addLicenseDeclaration(harvested, result) {
    if (!harvested.reuse.licenses) return
    const declaredLicenses = harvested.reuse.licenses
      .map(license => (isDeclaredLicense(SPDX.normalize(license.spdxId)) ? license.spdxId : null))
      .filter(x => x)
    setIfValue(result, 'licensed.declared', uniq(declaredLicenses).join(' AND '))
  }
}

/**
 * Factory function that creates a FsfeReuseSummarizer instance
 * @param {SummarizerOptions} [options] - Configuration options for the summarizer
 * @returns {FsfeReuseSummarizer} A new FsfeReuseSummarizer instance
 */
module.exports = options => new FsfeReuseSummarizer(options)
