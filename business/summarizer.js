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

  summarize(packageCoordinates, data) {
    return Object.getOwnPropertyNames(data).reduce((result, name) => {
      const value = data[name];
      const tool = name.substring(0, name.indexOf('--') - 1) || name;
      const summarizer = summarizers[tool];
      result[name] = summarizers.summarize(packageCoordinates, null, value)
      return result;
    }, {});
  }
}

module.exports = (options) => new Summarizer(options);