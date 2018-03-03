// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

const Cache = require('memory-cache').Cache;

class MemoryCache {

  constructor() {
    this.cache = new Cache();
  }

  async get(item) {
    return this.cache.get(item);
  }

  async set(item, value, expirationSeconds) {
    this.cache.put(item, value, 1000 * expirationSeconds);
  }

}

module.exports = () => new MemoryCache();