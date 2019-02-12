// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Cache = require('memory-cache').Cache

class MemoryCache {
  constructor(options) {
    this.cache = new Cache()
    this.defaultExpirationSeconds = options.defaultExpirationSeconds
  }

  initialize() {}

  get(item) {
    return this.cache.get(item)
  }

  set(item, value, expirationSeconds = null) {
    const expiration = 1000 * (expirationSeconds || this.defaultExpirationSeconds)
    this.cache.put(item, value, expiration)
  }

  delete(item) {
    this.cache.del(item)
  }
}

module.exports = options => new MemoryCache(options)
