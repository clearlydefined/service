// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

class CdSourceSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(coordinates, data) {
    const result = { described: {} };
    result.described.releaseDate = data.releaseDate;
    result.described.facets = data.facets;
    return result;
  }
}

module.exports = options => new CdSourceSummarizer(options);

