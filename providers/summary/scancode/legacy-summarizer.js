// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('../index').SummarizerOptions} SummarizerOptions
 * @typedef {import('../../logging').Logger} Logger
 * @typedef {import('../../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('../scancode').ScanCodeHarvestedData} ScanCodeHarvestedData
 * @typedef {import('../scancode').ScanCodeSummaryResult} ScanCodeSummaryResult
 * @typedef {import('../scancode').ScanCodeFile} ScanCodeFile
 * @typedef {import('../scancode').ScanCodeLicense} ScanCodeLicense
 * @typedef {import('../scancode').ScanCodePackage} ScanCodePackage
 * @typedef {import('../../../lib/utils').FileEntry} FileEntry
 */

const { get, flatten, uniq } = require('lodash')
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
} = require('../../../lib/utils')

/**
 * ScanCode Legacy summarizer class that processes harvested data from older
 * versions of ScanCode (2.2.1 through 30.1.0).
 * @class
 */
class ScanCodeLegacySummarizer {
  /**
   * Creates a new ScanCodeLegacySummarizer instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   * @param {Logger} logger - Logger instance for logging
   */
  constructor(options, logger) {
    this.options = options
    this.logger = logger
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {string} scancodeVersion - The version of ScanCode used to generate the harvested data. e.g. '2.2.1' or '3.0.2'
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {ScanCodeHarvestedData} harvested - the set of raw tool outputs related to the identified entity
   * @returns {ScanCodeSummaryResult} - a summary of the given raw information
   */
  summarize(scancodeVersion, coordinates, harvested) {
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

  /**
   * Adds described info (release date) to the result
   * @param {ScanCodeSummaryResult} result - The result object to modify
   * @param {ScanCodeHarvestedData} harvested - The harvested data
   */
  addDescribedInfo(result, harvested) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  /**
   * Gets declared license from the summary section
   * @param {string} scancodeVersion - The ScanCode version
   * @param {ScanCodeHarvestedData} harvested - The harvested data
   * @returns {string | null} Declared license expression or null
   * @private
   */
  _getDeclaredLicenseFromSummary(scancodeVersion, harvested) {
    let declaredLicense = this._readDeclaredLicenseFromSummary(scancodeVersion, harvested)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._readLicenseExpressionFromSummary(harvested) || declaredLicense
    }
    return declaredLicense
  }

  /**
   * Reads declared license from the summary packages
   * @param {string} scancodeVersion - The ScanCode version
   * @param {ScanCodeHarvestedData} harvested - The harvested data
   * @returns {string | null} Declared license expression or null
   * @private
   */
  _readDeclaredLicenseFromSummary(scancodeVersion, harvested) {
    switch (scancodeVersion) {
      case '2.2.1':
      case '2.9.1':
      case '2.9.2':
      case '2.9.8':
      case '3.0.0':
      case '3.0.2':
        return SPDX.normalize(
          /** @type {string | undefined} */ (get(harvested, 'content.summary.packages[0].declared_license'))
        )
      case '30.1.0': {
        const rawDeclaredLicense =
          /** @type {string | { name?: string; license?: string } | string[] | undefined} */
          (get(harvested, 'content.summary.packages[0].declared_license'))
        /** @type {string | { name?: string; license?: string } | undefined} */
        let declared_license = Array.isArray(rawDeclaredLicense) ? rawDeclaredLicense[0] : rawDeclaredLicense
        // Some Maven packages have this value as an object rather than a string
        // Example: for maven/mavencentral/redis.clients/jedis/4.1.1
        // declared_license would be { "name": "MIT", "url": "http://github.com/redis/jedis/raw/master/LICENSE.txt", "comments": null, "distribution": "repo" }'
        // Some pypi packages have this value as an object with a license field
        // Example: for pypi/pypi/abseil/absl-py/0.9.0
        // declared_license would be { "license": "Apache 2.0", "classifiers": ["License :: OSI Approved :: Apache Software License"] }
        if (typeof declared_license != 'string' && declared_license != undefined) {
          declared_license = declared_license.name || declared_license.license
        }

        return SPDX.normalize(/** @type {string | undefined} */ (declared_license))
      }
      default:
        throw new Error(`Invalid version of ScanCode: ${scancodeVersion}`)
    }
  }

  /**
   * Reads license expression from the summary
   * @param {ScanCodeHarvestedData} harvested - The harvested data
   * @returns {string | null} License expression or null
   * @private
   */
  _readLicenseExpressionFromSummary(harvested) {
    const licenseExpression = /** @type {string | undefined} */ (
      get(harvested, 'content.summary.packages[0].license_expression')
    )
    const result = licenseExpression && normalizeLicenseExpression(licenseExpression, this.logger)
    return result?.includes('NOASSERTION') ? null : result
  }

  /**
   * Gets the root files that should be considered for license determination
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @param {ScanCodeFile[]} files - All files from the scan
   * @param {ScanCodePackage[] | undefined} packages - Package information from the scan
   * @returns {ScanCodeFile[]} Array of root files
   * @private
   */
  // find and return the files that should be considered for as a license determinator for this summarization
  _getRootFiles(coordinates, files, packages) {
    const roots = getLicenseLocations(coordinates, packages) || []
    roots.push('') // for no prefix
    let rootFiles = this._findRootFiles(files, roots)
    //Some components (e.g. composer/packgist) are packaged under one directory
    if (rootFiles.length === 1 && rootFiles[0].type === 'directory') {
      rootFiles = this._findRootFiles(files, [`${rootFiles[0].path}/`])
    }
    return rootFiles
  }

  /**
   * Finds files at the root level given a set of root prefixes
   * @param {ScanCodeFile[]} files - All files to filter
   * @param {string[]} roots - Root path prefixes to match
   * @returns {ScanCodeFile[]} Filtered array of root files
   * @private
   */
  _findRootFiles(files, roots) {
    return files.filter(file => {
      for (let root of roots)
        if (file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1) return true
      return false
    })
  }

  /**
   * Gets declared license by analyzing root files
   * @param {string} scancodeVersion - The ScanCode version
   * @param {ScanCodeHarvestedData} harvested - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @returns {string | null} Declared license expression or null
   * @private
   */
  _getDeclaredLicenseFromFiles(scancodeVersion, harvested, coordinates) {
    const rootFile = this._getRootFiles(coordinates, harvested.content.files, harvested.content.packages)
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

  /**
   * Gets license from files marked as license text
   * @param {ScanCodeFile[]} files - Files to analyze
   * @returns {string | null} License expression or null
   * @private
   */
  _getLicenseByIsLicenseText(files) {
    const fullLicenses = files
      .filter(file => file.is_license_text && file.licenses)
      .reduce((licenses, file) => {
        file.licenses?.forEach(license => {
          licenses.add(this._createExpressionFromLicense(license))
        })
        return licenses
      }, /** @type {Set<string | null>} */ (new Set()))
    return joinExpressions(fullLicenses)
  }

  /**
   * Gets license from files matching license file naming patterns
   * @param {ScanCodeFile[]} files - Files to analyze
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @returns {string | null} License expression or null
   * @private
   */
  _getLicenseByFileName(files, coordinates) {
    const fullLicenses = files
      .filter(file => isLicenseFile(file.path, coordinates) && file.licenses)
      .reduce((licenses, file) => {
        file.licenses?.forEach(license => {
          if (license.score && license.score >= 90) licenses.add(this._createExpressionFromLicense(license))
        })
        return licenses
      }, /** @type {Set<string | null>} */ (new Set()))
    return joinExpressions(fullLicenses)
  }

  /**
   * Gets license from package assertion information
   * @param {ScanCodeFile[]} files - Files containing package information
   * @returns {string | null} License expression or null
   * @private
   */
  // Create a license expression from all of the package info in the output
  _getLicenseByPackageAssertion(files) {
    for (let file of files) {
      const asserted = /** @type {{ license?: string; spdx_license_key?: string }[] | undefined} */ (
        get(file, 'packages[0].asserted_licenses')
      )
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

  /**
   * Summarizes file information into FileEntry format
   * @param {ScanCodeFile[]} files - ScanCode file entries to summarize
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @returns {FileEntry[]} Array of summarized file entries
   * @private
   */
  _summarizeFileInfo(files, coordinates) {
    return files
      .map(file => {
        if (file.type !== 'file') return null
        /** @type {FileEntry} */
        const result = { path: file.path }
        const asserted = /** @type {ScanCodeLicense[] | undefined} */ (get(file, 'packages[0].asserted_licenses'))
        const fileLicense = asserted || file.licenses || []
        let licenses = new Set(
          fileLicense.map(/** @param {ScanCodeLicense} x */ x => x.license).filter(/** @param {unknown} x */ x => x)
        )
        if (!licenses.size)
          licenses = new Set(
            fileLicense
              .filter(/** @param {ScanCodeLicense} x */ x => x.score !== undefined && x.score >= 80)
              .map(/** @param {ScanCodeLicense} x */ x => this._createExpressionFromLicense(x))
          )
        const licenseExpression = joinExpressions(licenses)
        setIfValue(result, 'license', licenseExpression)
        if (this._getLicenseByIsLicenseText([file]) || this._getLicenseByFileName([file], coordinates)) {
          result.natures = result.natures || []
          if (!result.natures.includes('license')) result.natures.push('license')
        }
        setIfValue(
          result,
          'attributions',
          file.copyrights
            ? uniq(
                flatten(
                  file.copyrights.map(
                    /** @param {import('../scancode').ScanCodeCopyright} c */ c => c.statements || c.value
                  )
                )
              ).filter(/** @param {unknown} x */ x => x)
            : null
        )
        setIfValue(result, 'hashes.sha1', file.sha1)
        return result
      })
      .filter(/** @param {FileEntry | null} e */ e => e !== null)
  }

  /**
   * Creates a normalized license expression from a license object
   * @param {ScanCodeLicense} license - The license object from ScanCode
   * @returns {string | null} Normalized SPDX license expression or null
   * @private
   */
  _createExpressionFromLicense(license) {
    const rule = license.matched_rule
    if (!rule || !rule.license_expression) return SPDX.normalize(license.spdx_license_key)
    return normalizeLicenseExpression(rule.license_expression, this.logger, null)
  }
}

/**
 * Factory function that creates a ScanCodeLegacySummarizer instance
 * @param {SummarizerOptions} options - Configuration options for the summarizer
 * @param {Logger} logger - Logger instance for logging
 * @returns {ScanCodeLegacySummarizer} A new ScanCodeLegacySummarizer instance
 */
module.exports = (options, logger) => new ScanCodeLegacySummarizer(options, logger)
