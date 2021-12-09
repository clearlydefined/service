// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { setIfValue, isDeclaredLicense, isLicenseFile } = require('../../lib/utils')
const SPDX = require('@clearlydefined/spdx')
const { get, uniq } = require('lodash')

class FsfeReuseSummarizer {
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
    if (!harvested || !harvested.reuse || !harvested.reuse.metadata.CreatorTool) throw new Error('Invalid REUSE data')
    const result = {}

    setIfValue(result, 'files', this._summarizeFiles(harvested))
    return result
  }

  _summarizeFiles(harvested) {
    const files = get(harvested, 'reuse.files')
    if (!files) return null
    return files
      .map(file => {
        const path = file.FileName
        let declaredLicense = file.LicenseConcluded
        if (!isDeclaredLicense(declaredLicense)) {
          declaredLicense = file.LicenseInfoInFile
        }
        const license = SPDX.normalize(declaredLicense)
        if (path && isDeclaredLicense(license)) {
          const resultFile = { path, license, hashes: { sha1: file.FileChecksumSHA1 }, attributions: [file.FileCopyrightText] }
          return resultFile
        }
      })
  }

}

module.exports = options => new FsfeReuseSummarizer(options)
