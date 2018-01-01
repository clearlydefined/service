// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for summarizing tool-specific format to a normalized summary schema:
//  package:
//    type: string
//    provider: string
//    name: string
//    revision: string
//  described:
//    source_location:
//      type: string    
//      provider: string
//      url: string
//      revision: string
//      path: string
const _ = require('lodash');

class ClearlyDescribedSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(packageCoordinates, data, filter = null) {
    const sourceLocation = data.sourceInfo
      ? _.pick(data.sourceInfo, ['type', 'provider', 'url', 'revision', 'path'])
      : null;
    const result = this.getSourceLocation(data, filter);
    switch (packageCoordinates.type) {
      case 'npm':
        return this.addNpmData(result, data, filter);
      default:
        return result;
    }
  }

  getSourceLocation(data, filter) {
    const sourceLocation = data.sourceInfo
      ? _.pick(data.sourceInfo, ['type', 'provider', 'url', 'revision', 'path'])
      : null;
    return {
      described: { sourceLocation }
    };
  }

  addNpmData(result, data, filter) {
    result.described.projectWebsite = data.manifest.homepage;
    result.described.issueTracker = data.manifest.bugs;
    result.licensed = {
      license: data.manifest.license
    }
    return result;
  }
}

module.exports = options => new ClearlyDescribedSummarizer(options);

