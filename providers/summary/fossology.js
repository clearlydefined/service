// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./index').SummarizerOptions} SummarizerOptions
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./fossology').FossologyHarvestedData} FossologyHarvestedData
 * @typedef {import('./fossology').FossologySummaryResult} FossologySummaryResult
 * @typedef {import('../../lib/utils').FileEntry} FileEntry
 */

const { mergeDefinitions, setIfValue, isLicenseFile } = require('../../lib/utils')
const SPDX = require('@clearlydefined/spdx')
const { get, uniq } = require('lodash')

const noOpLicenseIds = new Set(['No_license_found', 'See-file', 'See-URL'])

/**
 * FOSSology summarizer class that processes harvested data from FOSSology tools.
 * Combines license information from Nomos and Monk scanners.
 * @class
 */
class FOSSologySummarizer {
  /**
   * Creates a new FOSSologySummarizer instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   */
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {FossologyHarvestedData} harvested - the set of raw tool outputs related to the identified entity
   * @returns {FossologySummaryResult} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    const result = {}
    // TODO currently definition merging does not union values (licenses, copyrights) at the file level.
    // That means the order here matters. Later merges overwrite earlier. So here we are explicitly taking
    // Nomos over Monk. The Copyright info should be orthogonal so order does not matter. In the future
    // we should resolve this merging problem but it's likely to be hard in general.
    this._summarizeMonk(result, harvested)
    this._summarizeNomos(result, harvested)
    this._summarizeCopyright(result, harvested)
    this._declareLicense(coordinates, result)
    return result
  }

  /**
   * Summarizes Nomos scanner output
   * @param {FossologySummaryResult} result - The result object to modify
   * @param {FossologyHarvestedData} output - The harvested data
   * @private
   */
  _summarizeNomos(result, output) {
    const content = /** @type {string | undefined} */ (get(output, 'nomos.output.content'))
    if (!content) return
    const files = content
      .split('\n')
      .map(
        /** @param {string} file */ file => {
          // File package/dist/ajv.min.js contains license(s) No_license_found
          const match = /^File (.*?) contains license\(s\) (.*?)$/.exec(file)
          if (!match) return null
          const [, path, rawLicense] = match
          const license = noOpLicenseIds.has(rawLicense) ? null : SPDX.normalize(rawLicense)
          if (path && license) return { path, license }
          if (path) return { path }
          return null
        }
      )
      .filter(/** @param {FileEntry | null} e */ e => e !== null)
    mergeDefinitions(result, { files })
  }

  /**
   * Summarizes Monk scanner output
   * @param {FossologySummaryResult} result - The result object to modify
   * @param {FossologyHarvestedData} output - The harvested data
   * @private
   */
  _summarizeMonk(result, output) {
    const content = /** @type {string | undefined} */ (get(output, 'monk.output.content'))
    if (!content) return
    const files = content
      .split('\n')
      .map(
        /** @param {string} file */ file => {
          const fullMatch = /^found full match between \\"(.*?)\\" and \\"(.*?)\\"/.exec(file)
          if (!fullMatch) return null
          const [, path, rawLicense] = fullMatch
          const license = SPDX.normalize(rawLicense)
          if (path && license) return { path, license }
          if (path) return { path }
          return null
        }
      )
      .filter(/** @param {FileEntry | null} e */ e => e !== null)
    mergeDefinitions(result, { files })
  }

  /**
   * Summarizes copyright information (currently disabled)
   * @param {FossologySummaryResult} _result - The result object to modify
   * @param {FossologyHarvestedData} _output - The harvested data
   * @see https://github.com/fossology/fossology/issues/1292
   * @private
   */
  // eslint-disable-next-line no-unused-vars
  _summarizeCopyright(_result, _output) {
    // see https://github.com/fossology/fossology/issues/1292
    return
    // const content = get(output, 'copyright.output.content')
    // if (!content) return
    // const files = content
    //   .map(entry => {
    //     const { path, output } = entry
    //     if (!output.results) return null
    //     const attributions = uniq(
    //       output.results
    //         .filter(result => result.type === 'statement')
    //         .map(result => result.content)
    //         .filter(e => e)
    //     )
    //     const file = { path }
    //     setIfValue(file, 'attributions', attributions)
    //     return file
    //   })
    //   .filter(e => e)
    // mergeDefinitions(result, { files })
  }

  /**
   * Declares license from analyzed license files
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @param {FossologySummaryResult} result - The result object to modify
   * @private
   */
  _declareLicense(coordinates, result) {
    if (!result.files) return
    // if we know this is a license file by the name of it and it has a license detected in it
    // then let's declare the license for the component
    const licenses = uniq(
      result.files.filter(file => file.license && isLicenseFile(file.path, coordinates)).map(file => file.license)
    )
    setIfValue(result, 'licensed.declared', licenses.join(' AND '))
  }
}

/**
 * Factory function that creates a FOSSologySummarizer instance
 * @param {SummarizerOptions} [options] - Configuration options for the summarizer
 * @returns {FOSSologySummarizer} A new FOSSologySummarizer instance
 */
module.exports = options => new FOSSologySummarizer(options)
