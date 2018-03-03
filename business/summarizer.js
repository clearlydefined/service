// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const summarizers = require('../providers/summary')

class SummaryService {
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the data for each of the supplied data points for different versions of an
   * identified tool. Use the given filter function to determine if a particular file
   * mentioned in the data should play a role in summarization.
   *
   * @param {EntityCoordinates} coordinates the component being summarized
   * @param {string} tool the name of the tool whose output is being summarized
   * @param {*} data the data to summarize
   * @param {function} filter filter function identifying analyzed files to NOT include in the summary
   */
  _summarizeTool(coordinates, tool, data, filter = null) {
    if (!summarizers[tool]) return data
    const summarizer = summarizers[tool](this.options[tool] || {})
    return Object.getOwnPropertyNames(data).reduce((result, version) => {
      result[version] = summarizer.summarize(coordinates, data[version], filter)
      return result
    }, {})
  }

  summarizeFacets(coordinates, data) {
    return this.summarizeAll(coordinates, data, null)
  }

  /**
   * Summarize all of the data for the identified component using the given filter function
   * to determine if a particular file mentioned in the data should play a role in summarization.
   *
   * @param {} coordinates the component being summarized
   * @param {*} data the data to summarize
   * @param {function} filter filter function identifying analyzed files to NOT include in the summary
   */
  summarizeAll(coordinates, data, filter = {}) {
    const summary = Object.getOwnPropertyNames(data).reduce((result, tool) => {
      result[tool] = this._summarizeTool(coordinates, tool, data[tool], filter)
      return result
    }, {})
    summary.coordinates = coordinates
    return summary
  }
}

module.exports = options => new SummaryService(options)
