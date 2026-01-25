// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./index').SummarizerOptions} SummarizerOptions
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./cdsource').CdSourceHarvestedData} CdSourceHarvestedData
 * @typedef {import('./cdsource').CdSourceSummaryResult} CdSourceSummaryResult
 */

const { extractDate } = require('../../lib/utils')

/**
 * CdSource summarizer class that processes harvested data from the ClearlyDefined
 * source tool. Extracts basic release date and facet information.
 * @class
 */
class CdSourceSummarizer {
  /**
   * Creates a new CdSourceSummarizer instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   */
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntityCoordinates} _coordinates - The entity for which we are summarizing
   * @param {CdSourceHarvestedData} data - The set of raw tool outputs related to the identified entity
   * @returns {CdSourceSummaryResult} A summary of the given raw information
   */
  summarize(_coordinates, data) {
    /** @type {CdSourceSummaryResult} */
    const result = { described: {} }
    result.described.releaseDate = extractDate(data.releaseDate)
    result.described.facets = data.facets
    return result
  }
}

/**
 * Factory function that creates a CdSourceSummarizer instance
 * @param {SummarizerOptions} [options] - Configuration options for the summarizer
 * @returns {CdSourceSummarizer} A new CdSourceSummarizer instance
 */
module.exports = options => new CdSourceSummarizer(options)
