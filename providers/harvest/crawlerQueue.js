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
      let message = JSON.stringify({
        type: entry.tool || 'component',
        url: `cd:/${this.toUrl(entry)}`,
        policy: entry.policy || {
          fetch: 'mutables',
          freshness: 'match',
          map: { name: entry.tool || 'component', path: '/' }
        }
      })
      if (turbo) this.normalQueue.queue(message)
      else this.laterQueue.queue(message)
    }
  }

  toUrl(entry) {
    return entry?.coordinates?.toString().replace(/[/]+/g, '/')
  }

}

module.exports = options => new CrawlingQueueHarvester(options)
