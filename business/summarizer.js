// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for summarizing tool-specific format to a normalized summary schema:
//   package:
//     type: string
//     name: string
//     provider: string
//     revision: string
//   source_location:
//     provider: string
//     url: string
//     revision: string
//     path: string
//   copyright:
//     statements: string[]
//     holders: string[]
//     authors: string[]
//   license:
//     expression: string

const summarizers = require('../providers/summary');

class Summarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(packageCoordinates, toolConfiguration, filter, data) {
    const toolName = (toolConfiguration.substring(0, toolConfiguration.indexOf('--')) || toolConfiguration).toLowerCase();
    if (!summarizers[toolName])
      return data;
    const summarizer = summarizers[toolName](this.options[toolName] || {});
    return summarizer.summarize(packageCoordinates, filter, data);
  }

  summarizeAll(packageCoordinates, filter, data) {
    return Object.getOwnPropertyNames(data).reduce((result, toolConfiguration) => {
      result[toolConfiguration] = this.summarize(packageCoordinates, toolConfiguration, filter, data[toolConfiguration]);
      return result;
    }, {});
  }
}

module.exports = (options) => new Summarizer(options);