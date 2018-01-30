// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native');

class CrawlingHarvester {

  constructor(options) {
    this.options = options;
  }

  async harvest(spec) {
    const headers = {
      'X-token': this.options.authToken,
      // Authorization: 'basic' + this.options.authToken
    };
    return requestPromise({
      url: `${this.options.url}/requests`,
      method: 'POST',
      body: spec,
      headers,
      json: true
    });
  }
}

module.exports = options => new CrawlingHarvester(options);