// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')

class CrawlingQueueHarvester {
  constructor(options) {
    this.logger = logger()
    this.normalQueue = options.normal
    this.laterQueue = options.later
  }

  async harvest(spec, turbo) {
    const entries = Array.isArray(spec) ? spec : [spec]
    for (let entry of entries) {
      let message = JSON.stringify(this.toHarvestItem(entry))
      if (turbo) this.normalQueue.queue(message)
      else this.laterQueue.queue(message)
    }
  }

  toHarvestItem(entry) {
    return {
      type: entry.tool || 'component',
      url: `cd:/${entry.coordinates.toString().replace(/[/]+/g, '/')}`,
      policy: entry.policy || {
        fetch: 'mutables',
        freshness: 'match',
        map: { name: entry.tool || 'component', path: '/' }
      }
    }
  }
}

module.exports = options => new CrawlingQueueHarvester(options)
