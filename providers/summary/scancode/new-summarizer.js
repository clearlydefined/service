// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('../index').SummarizerOptions} SummarizerOptions
 * @typedef {import('../../logging').Logger} Logger
 * @typedef {import('../../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('../scancode').ScanCodeHarvestedData} ScanCodeHarvestedData
 * @typedef {import('../scancode').ScanCodeSummaryResult} ScanCodeSummaryResult
 * @typedef {import('../scancode').ScanCodeFile} ScanCodeFile
 * @typedef {import('../scancode').ScanCodePackage} ScanCodePackage
 * @typedef {import('../scancode').ScanCodeLicenseDetection} ScanCodeLicenseDetection
 * @typedef {import('../scancode').ScanCodeCopyright} ScanCodeCopyright
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
  joinExpressions,
  normalizeLicenseExpression
} = require('../../../lib/utils')

/**
 * ScanCode New summarizer class that processes harvested data from newer
 * versions of ScanCode (32.1.0 and above).
 * @class
 */
class ScanCodeNewSummarizer {
  /**
   * Creates a new ScanCodeNewSummarizer instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   * @param {Logger} logger - Logger instance for logging
   */
  constructor(options, logger) {
    this.options = options
    this.logger = logger
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {string} scancodeVersion - The version of ScanCode used
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {ScanCodeHarvestedData} harvestedData - the set of raw tool outputs related to the identified entity
   * @returns {ScanCodeSummaryResult} - a summary of the given raw information
   * @throws {Error} If ScanCode version is not provided
   */
  summarize(scancodeVersion, coordinates, harvestedData) {
    if (!scancodeVersion) throw new Error('Not valid ScanCode data')

    const result = {}
    this.addDescribedInfo(result, harvestedData)

    let declaredLicense = this._getDeclaredLicense(harvestedData)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._getDetectedLicensesFromFiles(harvestedData, coordinates) || declaredLicense
    }
    setIfValue(result, 'licensed.declared', declaredLicense)

    result.files = this._summarizeFileInfo(harvestedData.content.files, coordinates)

    return result
  }

  /**
   * Adds described info (release date) to the result
   * @param {ScanCodeSummaryResult} result - The result object to modify
   * @param {ScanCodeHarvestedData} harvestedData - The harvested data
   */
  addDescribedInfo(result, harvestedData) {
    const releaseDate = harvestedData._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: extractDate(releaseDate.trim()) }
  }

  /**
   * Gets declared license from multiple sources in order of priority
   * @param {ScanCodeHarvestedData} harvestedData - The harvested data
   * @returns {string | null} Declared license expression or null
   * @private
   */
  _getDeclaredLicense(harvestedData) {
    const licenseReaders = [
      this._readDeclaredLicenseExpressionFromSummary.bind(this),
      this._readDeclaredLicenseExpressionFromPackage.bind(this),
      this._readExtractedLicenseStatementFromPackage.bind(this)
    ]

    for (const reader of licenseReaders) {
      const declaredLicense = reader(harvestedData)
      if (isDeclaredLicense(declaredLicense)) {
        return declaredLicense
      }
    }

    return null
  }

  /**
   * Reads declared license expression from summary section
   * @param {Object} harvestedData - The harvested data
   * @param {import('../scancode').ScanCodeContent} harvestedData.content - The content from harvested data
   * @returns {string | null} License expression or null
   * @private
   */
  _readDeclaredLicenseExpressionFromSummary({ content }) {
    const licenseExpression = /** @type {string | undefined} */ (get(content, 'summary.declared_license_expression'))
    const result = licenseExpression && normalizeLicenseExpression(licenseExpression, this.logger)

    return result?.includes('NOASSERTION') ? null : result
  }

  /**
   * Reads declared license expression from package information
   * @param {Object} harvestedData - The harvested data
   * @param {import('../scancode').ScanCodeContent} harvestedData.content - The content from harvested data
   * @returns {string | null} License expression or null
   * @private
   */
  _readDeclaredLicenseExpressionFromPackage({ content }) {
    const { packages } = content
    if (!packages) return null
    const [firstPackage] = packages
    if (!firstPackage) return null

    const licenseExpression = firstPackage.declared_license_expression_spdx

    return licenseExpression?.includes('NOASSERTION') ? null : licenseExpression
  }

  /**
   * Reads extracted license statement from package information
   * @param {Object} harvestedData - The harvested data
   * @param {import('../scancode').ScanCodeContent} harvestedData.content - The content from harvested data
   * @returns {string | null} Normalized license expression or null
   * @private
   */
  _readExtractedLicenseStatementFromPackage({ content }) {
    const declared_license = /** @type {string | undefined} */ (get(content, 'packages[0].extracted_license_statement'))
    return SPDX.normalize(declared_license)
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
    return files.filter(
      /** @param {ScanCodeFile} file */ file => {
        for (let root of roots) {
          if (file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1) return true
        }
        return false
      }
    )
  }

  /**
   * Gets detected licenses from files when no declared license is found
   * @param {ScanCodeHarvestedData} harvestedData - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @returns {string | null} License expression or null
   * @private
   */
  _getDetectedLicensesFromFiles(harvestedData, coordinates) {
    const rootFiles = this._getRootFiles(coordinates, harvestedData.content.files, harvestedData.content.packages)
    return this._getFileLicensesFromDetectedLicenseExpressions(rootFiles)
  }

  /**
   * Gets license expressions from files based on detected_license_expression_spdx
   * @param {ScanCodeFile[]} files - Files to analyze
   * @returns {string | null} License expression or null
   * @private
   */
  _getFileLicensesFromDetectedLicenseExpressions(files) {
    const fullLicenses = new Set(
      files
        .filter(
          /** @param {ScanCodeFile} file */ file =>
            file.percentage_of_license_text >= 90 && file.detected_license_expression_spdx
        )
        .map(/** @param {ScanCodeFile} file */ file => /** @type {string} */ (file.detected_license_expression_spdx))
    )
    return joinExpressions(fullLicenses)
  }

  /**
   * Gets the closest license match by analyzing license file names
   * @param {ScanCodeFile[]} files - Files to analyze
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @returns {string | null} License expression or null
   * @private
   */
  _getClosestLicenseMatchByFileName(files, coordinates) {
    const fullLicenses = files
      .filter(
        /** @param {ScanCodeFile} file */ file => isLicenseFile(file.path, coordinates) && file.license_detections
      )
      .reduce(
        /**
         * @param {Set<string>} licenses
         * @param {ScanCodeFile} file
         */
        (licenses, file) => {
          file.license_detections?.forEach(
            /** @param {ScanCodeLicenseDetection} licenseDetection */ licenseDetection => {
              if (licenseDetection.license_expression_spdx) {
                licenses.add(licenseDetection.license_expression_spdx)
                return
              }
              licenseDetection.matches?.forEach(
                /** @param {{ score?: number; spdx_license_expression?: string }} match */ match => {
                  // Only consider matches with high clarity score of 90 or higher
                  if (match.score >= 90) {
                    licenses.add(match.spdx_license_expression)
                  }
                }
              )
            }
          )
          return licenses
        },
        /** @type {Set<string>} */ (new Set())
      )
    return joinExpressions(fullLicenses)
  }

  /**
   * Gets license expression from file's license detections
   * @param {ScanCodeFile} file - The file to analyze
   * @returns {string | null} License expression or null
   * @private
   */
  _getLicenseExpressionFromFileLicenseDetections(file) {
    if (!file.license_detections) return null
    const licenseExpressions = file.license_detections.reduce(
      /**
       * @param {Set<string>} licenseExpressions
       * @param {ScanCodeLicenseDetection} licenseDetection
       */
      (licenseExpressions, licenseDetection) => {
        if (licenseDetection.license_expression_spdx) {
          licenseExpressions.add(licenseDetection.license_expression_spdx)
        } else {
          licenseDetection.matches?.forEach(
            /** @param {{ score?: number; spdx_license_expression?: string }} match */ match => {
              // Only consider matches with a reasonably high score of 80 or higher
              if (match.score >= 80) {
                licenseExpressions.add(match.spdx_license_expression)
              }
            }
          )
        }
        return licenseExpressions
      },
      /** @type {Set<string>} */ (new Set())
    )
    return joinExpressions(licenseExpressions)
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
      .map(
        /** @param {ScanCodeFile} file */ file => {
          if (file.type !== 'file') return null

          /** @type {FileEntry} */
          const result = { path: file.path }

          const licenseExpression =
            file.detected_license_expression_spdx || this._getLicenseExpressionFromFileLicenseDetections(file)
          setIfValue(result, 'license', licenseExpression)

          if (
            this._getFileLicensesFromDetectedLicenseExpressions([file]) ||
            this._getClosestLicenseMatchByFileName([file], coordinates)
          ) {
            result.natures = result.natures || []
            if (!result.natures.includes('license')) result.natures.push('license')
          }

          setIfValue(
            result,
            'attributions',
            file.copyrights
              ? uniq(
                  flatten(
                    file.copyrights.map(/** @param {ScanCodeCopyright} c */ c => c.copyright || c.statements || c.value)
                  )
                ).filter(/** @param {unknown} x */ x => x)
              : null
          )
          setIfValue(result, 'hashes.sha1', file.sha1)
          setIfValue(result, 'hashes.sha256', file.sha256)

          return result
        }
      )
      .filter(/** @param {FileEntry | null} e */ e => e !== null)
  }
}

/**
 * Factory function that creates a ScanCodeNewSummarizer instance
 * @param {SummarizerOptions} options - Configuration options for the summarizer
 * @param {Logger} logger - Logger instance for logging
 * @returns {ScanCodeNewSummarizer} A new ScanCodeNewSummarizer instance
 */
module.exports = (options, logger) => new ScanCodeNewSummarizer(options, logger)
