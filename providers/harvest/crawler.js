// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')

class CrawlingHarvester {
  constructor(options) {
    this.options = options
  }

  async harvest(spec) {
    const headers = {
      'X-token': this.options.authToken
    }
    const body = (Array.isArray(spec) ? spec : [spec]).map(entry => {
      return {
        type: entry.tool,
        url: `cd:/${entry.coordinates}`,
        policy: entry.policy
      }
    })
    return requestPromise({
      url: `${this.options.url}/requests`,
      method: 'POST',
      body,
      headers,
      json: true,
      resolveWithFullResponse: true
    })
    .then(function (res) {
        console.log("POST returned with status %d", handleResponseCodes(res.statusCode));
    })
    .catch(function (err) {
        console.log("POST failed with status %d", err.statusCode);
        console.log(err)
    });
  }
}

function handleResponseCodes(statusCode){
    switch (statusCode) {
    case 200:
        text = "200 OK - Success";
        break;
    case 207:
        text = "207 - At least one item was not successfully indexed";
        break;
    case 429:
        text = "429 - You have exceeded your quota on the number of documents per index.";
        break;
    case 503:
        text = "503 -The system is under heavy load and your request can't be processed at this time.";
        break;
    }
    return text;
}


module.exports = options => new CrawlingHarvester(options)
