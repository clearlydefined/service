// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const _ = require('lodash');

class ClearlyDescribedSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(coordinates, data, filter = null) {
    const result = { described: {} };
    this.addSourceLocation(result, data, filter);
    switch (coordinates.type) {
      case 'npm':
        this.addNpmData(result, data, filter);
        break;
      default:
    }
    return result;
  }

  addSourceLocation(result, data) {
    if (data.sourceInfo)
      result.described.sourceLocation = _.pick(data.sourceInfo, ['type', 'provider', 'url', 'revision', 'path']);
  }

  addNpmData(result, data) {
    result.described.projectWebsite = data.registryData.manifest.homepage;
    result.described.issueTracker = data.registryData.manifest.bugs;
    result.described.releaseDate = data.registryData.releaseDate
    result.licensed = {
      license: data.registryData.manifest.license
    };
    return result;
  }
}

module.exports = options => new ClearlyDescribedSummarizer(options);

