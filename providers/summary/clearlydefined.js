// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const _ = require('lodash');

class ClearlyDescribedSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(coordinates, data, filter = null) {
    const result = { described: {} };
    this.addFacetInfo(result, data);
    if (!filter)
      // if just getting facets, we're done
      return result;
    this.addSourceLocation(result, data, filter);
    switch (coordinates.type) {
      case 'npm':
        this.addNpmData(result, data, filter);
        break;
      case 'maven':
        this.addMavenData(result, data, filter);
        break;
      case 'sourcearchive':
        this.addSourceArchiveData(result, data, filter);
        break;
      default:
    }
    return result;
  }

  addFacetInfo(result, data) {
    result.described.facets = data.facets;
  }

  addSourceLocation(result, data) {
    if (data.sourceInfo)
      result.described.sourceLocation = _.pick(data.sourceInfo, ['type', 'provider', 'url', 'revision', 'path']);
  }

  addMavenData(result, data) {
    result.described.releaseDate = data.releaseDate;
  }

  addSourceArchiveData(result, data) {
    result.described.releaseDate = data.releaseDate;
  }

  addNpmData(result, data) {
    result.described.projectWebsite = data.registryData.manifest.homepage;
    result.described.issueTracker = data.registryData.manifest.bugs;
    result.described.releaseDate = data.registryData.releaseDate;
    result.licensed = {
      declared: { 
        expression: data.registryData.manifest.license
      }
    };
  }
}

module.exports = options => new ClearlyDescribedSummarizer(options);

