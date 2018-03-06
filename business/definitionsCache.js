// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MemoryCache = require('../providers/caching/memory')()

class DefinitionsCache {
  static async get(coordinates) {
    return await MemoryCache.get(coordinates)
  }

  static async set(coordinates, result, expirationInSec = 5 * 60) {
    await MemoryCache.set(coordinates, result, expirationInSec)
  }
}

module.exports = DefinitionsCache
