// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for summarizing tool-specific format to a normalized summary schema:
//  package:
//    type: string
//    provider: string
//    namespace: string
//    name: string
//    revision: string
//  described: 
//    source_location:
//      type: string
//      provider: string
//      url: string
//      revision: string
//      path: string
//  licensed:  
//    copyright:
//      statements: string[]
//      holders: string[]
//      authors: string[]
//    license:
//      expression: string

const summarizers = require('../providers/summary');

class SummaryService {

  constructor(options) {
    this.options = options;
  }

  /**
   * Summarize the data for each of the supplied data points for different versions of an
   * identified tool. Use the given filter function to determine if a particular file
   * mentioned in the data should play a role in summarization.
   * 
   * @param {} packageCoordinates the package being summarized
   * @param {string} tool the name of the tool whose output is being summarized
   * @param {*} data the data to summarize
   * @param {function} filter filter function identifying analyzed files to NOT include in the summary
   */
  summarizeTool(packageCoordinates, tool, data, filter = null) {
    if (!summarizers[tool])
      return data;
    const summarizer = summarizers[tool](this.options[tool] || {});
    return Object.getOwnPropertyNames(data).reduce((result, version) => {
      result[version] = summarizer.summarize(packageCoordinates, data[version], filter);
      return result;
    }, {});
  }

  /**
   * Summarize all of the data for the identified package using the given filter function 
   * to determine if a particular file mentioned in the data should play a role in summarization.
   * 
   * @param {} packageCoordinates the package being summarized
   * @param {*} data the data to summarize
   * @param {function} filter filter function identifying analyzed files to NOT include in the summary
   */
  summarizeAll(packageCoordinates, data, filter = null) {
    return Object.getOwnPropertyNames(data).reduce((result, tool) => {
      result[tool] = this.summarizeTool(packageCoordinates, tool, data[tool], filter);
      return result;
    }, {});
  }
}

module.exports = options => new SummaryService(options);