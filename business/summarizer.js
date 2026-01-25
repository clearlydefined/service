// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./summarizer').SummaryServiceOptions} SummaryServiceOptions
 * @typedef {import('./summarizer').SummarizedData} SummarizedData
 * @typedef {import('../lib/entityCoordinates')} EntityCoordinates
 */

const summarizers = require('../providers/summary')

/**
 * Service for summarizing tool output data.
 * Delegates to tool-specific summarizers to process raw harvest data.
 */
class SummaryService {
  /**
   * Creates a new SummaryService instance
   * @param {SummaryServiceOptions} options - Tool-specific configuration options
   */
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the data for each of the supplied data points for different versions of an
   * identified tool.
   *
   * @param {EntityCoordinates} coordinates - The component being summarized
   * @param {string} tool - The name of the tool whose output is being summarized
   * @param {Record<string, any>} data - The data to summarize (keyed by version)
   * @returns {Record<string, any>} Summarized data keyed by version
   * @private
   */
  _summarizeTool(coordinates, tool, data) {
    if (!summarizers[tool]) return data
    const summarizer = summarizers[tool](this.options[tool] || {})
    return Object.getOwnPropertyNames(data).reduce((result, version) => {
      result[version] = summarizer.summarize(coordinates, data[version])
      return result
    }, /** @type {Record<string, any>} */ ({}))
  }

  /**
   * Summarize all of the data for the identified component.
   *
   * @param {EntityCoordinates} coordinates - The component being summarized
   * @param {SummarizedData} data - The data to summarize (keyed by tool name and version)
   * @returns {SummarizedData} Summarized data for all tools
   */
  summarizeAll(coordinates, data) {
    return Object.getOwnPropertyNames(data || {}).reduce((result, tool) => {
      result[tool] = this._summarizeTool(coordinates, tool, data[tool])
      return result
    }, /** @type {SummarizedData} */ ({}))
  }
}

/**
 * Factory function to create a SummaryService instance
 * @param {SummaryServiceOptions} options - Tool-specific configuration options
 * @returns {SummaryService} A new SummaryService instance
 */
module.exports = options => new SummaryService(options)
