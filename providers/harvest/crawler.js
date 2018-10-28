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
    const options = {
      url: `${this.options.url}/requests`,
      method: 'POST',
      body,
      headers,
      json: true,
      resolveWithFullResponse: true,
    }
    const cases = {
      200: '200 OK -  Success',
      207: '207 - At least one item was not successfully indexed',
      400: 'Bad Request',
      401: 'Unauthorized',
      404: 'Not Found',
      429: '429 - You have exceeded your quota on the number of documents per index.',
      503: '503 -The system is under heavy load and your request cannot be processed at this time.'
    }

    try{
        const result = await requestPromise(options, function(err, res, body) {
            if(cases[res.statusCode] === '200') {
              return cases[res.statusCode]
            }
        })
    } catch (err) {
          return cases[err.statusCode]
    }
  }
}


module.exports = options => new CrawlingHarvester(options)
