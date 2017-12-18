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

class ClearlyDescribedSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(packageCoordinates, filter, data) {
    return data['output.json'];
  }
}

module.exports = (options) => new ClearlyDescribedSummarizer(options);
