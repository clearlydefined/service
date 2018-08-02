// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const summarizers = require('../providers/summary')

class SummaryService {
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the data for each of the supplied data points for different versions of an
   * identified tool.
   *
   * @param {EntityCoordinates} coordinates the component being summarized
   * @param {string} tool the name of the tool whose output is being summarized
   * @param {*} data the data to summarize
   */
  _summarizeTool(coordinates, tool, data) {
    if (!summarizers[tool]) return data
    const summarizer = summarizers[tool](this.options[tool] || {})
    return Object.getOwnPropertyNames(data).reduce((result, version) => {
      result[version] = summarizer.summarize(coordinates, data[version])
      return result
    }, {})
  }

  /**
   * Summarize all of the data for the identified component.
   *
   * @param {} coordinates the component being summarized
   * @param {*} data the data to summarize
   */
  summarizeAll(coordinates, data) {
    const summary = Object.getOwnPropertyNames(data).reduce((result, tool) => {
      result[tool] = this._summarizeTool(coordinates, tool, data[tool])
      return result
    }, {})
    summary.coordinates = coordinates
    return summary
  }
}

module.exports = options => new SummaryService(options)
