// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// curl -X POST "https://api.cloudflare.com/client/v4/zones/023e105f4ecef8ad9ca31a8372d0c353/purge_cache" \
//      -H "X-Auth-Email: user@example.com" \
//      -H "X-Auth-Key: c2547eb745079dac9320b638f5e225cf483cc5cfdda41" \
//      -H "Content-Type: application/json" \
//      --data '{"tags":["some-tag","another-tag"],"hosts":["www.example.com","images.example.com"]}'

// Cache-Tag and host purging each have a rate limit of 30,000 purge API calls in every 24 hour period. 
// You may purge up to 30 tags or hosts in one API call. 
// This rate limit can be raised for customers who need to purge at higher volume.

const requestPromise = require('request-promise-native')
const waterMark = 30
const defaultIntervalMs = 60000 * 5

function isValidTag(tag) {
  return typeof tag === 'string' &&
    tag.length > 0 &&
    tag.indexOf(' ') === -1
}

class Cdn {
  constructor(options) {
    this.options = options
    this._queue = {}
    this.doRequest = requestPromise
    this.intervalMs = options.intervalMs || defaultIntervalMs
  }

  initialize() {
    this._timeout = setInterval(this.flushPending, this.intervalMs)
  }

  uninitialize() {
    clearInterval(this._timeout)
  }

  flushPending() {
    if (this._queue) {
      for (let keys = Object.keys(this._queue); keys.length > 0; keys = keys.slice(30)) {
        let keyBlock = keys.slice(0, 30)
        this.doRequest({
          url: this.options.flushByTagUrl,
          method: 'POST',
          body: JSON.stringify({ tags: keyBlock }),
          headers: {
            'X-Auth-Email': this.options.apiEmail,
            'X-Auth-Key': this.options.apiKey
          },
          json: true
        })
      }
      this._queue = {}
      this._timeout.refresh()
    }
  }

  queue(tag) {
    tag = tag.toString()
    if (isValidTag(tag)) {
      this._queue[tag] = true
      if (Object.keys(this._queue).length >= waterMark) {
        this.flushPending()
      }
    }
  }
}

module.exports = options => new Cdn(options)
