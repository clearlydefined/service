// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { setIfValue, isDeclaredLicense } = require('../../lib/utils')
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
   * @param {*} harvested - the set of raw tool outputs related to the identified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    if (!harvested || !harvested.reuse || !harvested.reuse.metadata.CreatorTool) throw new Error('Invalid REUSE data')
    const result = {}

    setIfValue(result, 'files', this._summarizeFiles(harvested))
    this._addLicenseDeclaration(harvested, result)
    return result
  }

  _summarizeFiles(harvested) {
    const files = get(harvested, 'reuse.files')
    if (!files) return null
    const licenseFiles = []
    const attachments = harvested.attachments || []
    const licenses = get(harvested, 'reuse.licenses')
    if (licenses) {
      licenses.forEach(license => {
        const licenseSpdxId = SPDX.normalize(license.spdxId)
        if (license.filePath && isDeclaredLicense(licenseSpdxId)) {
          const attachment = attachments.find(x => x.path === license.filePath)
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
          const resultFile = { path, license, hashes: { sha1: file.FileChecksumSHA1 } }
          if (file.FileCopyrightText && file.FileCopyrightText !== 'NONE') {
            resultFile['attributions'] = [file.FileCopyrightText]
          }
          return resultFile
        }
      })
      .concat(licenseFiles)
      .filter(e => e)
  }

  _addLicenseDeclaration(harvested, result) {
    if (!harvested.reuse.licenses) return
    const declaredLicenses = harvested.reuse.licenses
      .map(license => (isDeclaredLicense(SPDX.normalize(license.spdxId)) ? license.spdxId : null))
      .filter(x => x)
    setIfValue(result, 'licensed.declared', uniq(declaredLicenses).join(' AND '))
  }
}

module.exports = options => new FsfeReuseSummarizer(options)
