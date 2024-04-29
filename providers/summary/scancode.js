// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, flatten, uniq } = require('lodash')
const { gte } = require('semver')
const SPDX = require('@clearlydefined/spdx')
const {
  extractDate,
  isDeclaredLicense,
  getLicenseLocations,
  isLicenseFile,
  setIfValue,
  addArrayToSet,
  joinExpressions,
  normalizeLicenseExpression
} = require('../../lib/utils')
const logger = require('../logging/logger')
const ScanCodeSummarizerNew = require('./scancode-new')

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

    if (gte(scancodeVersion, '32.0.8')) {
      return ScanCodeSummarizerNew(this.options).summarize(coordinates, harvested)
    }

    const result = {}
    this.addDescribedInfo(result, harvested)
    let declaredLicense = this._getDeclaredLicenseFromSummary(scancodeVersion, harvested)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._getDeclaredLicenseFromFiles(scancodeVersion, harvested, coordinates) || declaredLicense
    }
    setIfValue(result, 'licensed.declared', declaredLicense)
    result.files = this._summarizeFileInfo(harvested.content.files, coordinates)
    return result
  }

  addDescribedInfo(result, harvested) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  _getDeclaredLicenseFromSummary(scancodeVersion, harvested) {
    let declaredLicense = this._readDeclaredLicenseFromSummary(scancodeVersion, harvested)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._readLicenseExpressionFromSummary(harvested) || declaredLicense
    }
    return declaredLicense
  }

  _readDeclaredLicenseFromSummary(scancodeVersion, harvested) {
    switch (scancodeVersion) {
      case '2.2.1':
      case '2.9.1':
      case '2.9.2':
      case '2.9.8':
      case '3.0.0':
      case '3.0.2':
        return SPDX.normalize(get(harvested, 'content.summary.packages[0].declared_license'))
      case '30.1.0': {
        let declared_license = get(harvested, 'content.summary.packages[0].declared_license')
        if (Array.isArray(declared_license)) declared_license = declared_license[0]
        // Some Maven packages have this value as an object rather than a string
        // Example: for maven/mavencentral/redis.clients/jedis/4.1.1
        // declared_license would be { "name": "MIT", "url": "http://github.com/redis/jedis/raw/master/LICENSE.txt", "comments": null, "distribution": "repo" }'
        // Some pypi packages have this value as an object with a license field
        // Example: for pypi/pypi/abseil/absl-py/0.9.0
        // declared_license would be { "license": "Apache 2.0", "classifiers": ["License :: OSI Approved :: Apache Software License"] }
        if (typeof declared_license != 'string' && declared_license != undefined) {
          declared_license = declared_license['name'] || declared_license['license']
        }

        return SPDX.normalize(declared_license)
      }
      default:
        throw new Error(`Invalid version of ScanCode: ${scancodeVersion}`)
    }
  }

  _readLicenseExpressionFromSummary(harvested) {
    const licenseExpression = get(harvested, 'content.summary.packages[0].license_expression')
    const result = licenseExpression && normalizeLicenseExpression(licenseExpression)
    return result?.includes('NOASSERTION') ? null : result
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
      for (let root of roots)
        if (file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1) return true
    })
  }

  _getDeclaredLicenseFromFiles(scancodeVersion, harvested, coordinates) {
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
      case '30.1.0':
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
    return joinExpressions(fullLicenses)
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
    return joinExpressions(fullLicenses)
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
        return joinExpressions(packageLicenses)
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
        const licenseExpression = joinExpressions(licenses)
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

  _createExpressionFromLicense(license) {
    const rule = license.matched_rule
    if (!rule || !rule.license_expression) return SPDX.normalize(license.spdx_license_key)
    return normalizeLicenseExpression(rule.license_expression)
  }
}

module.exports = options => new ScanCodeSummarizer(options)
