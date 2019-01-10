// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const logger = require('../logging/logger')

class CrawlingHarvester {
  constructor(options) {
    this.logger = logger()
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
    try {
      const response = await requestPromise({
        url: `${this.options.url}/requests`,
        method: 'POST',
        body,
        headers,
        json: true
      })
      if (response.statusCode === '200') return
    } catch (error) {
      this.logger.info('failed to harvest from crawling service', {
        crawlerError: error.error,
        coordinates: spec.toString()
      })
      switch (error.statusCode) {
        case 403:
          throw new Error('Forbidden')
        default:
          throw new Error('Unable to queue request')
      }
    }
  }
}


module.exports = options => new CrawlingHarvester(options)
