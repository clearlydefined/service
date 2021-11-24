// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const defaultcache = require('../providers/caching/memory')({ defaultTtlSeconds: 60 * 60 * 24 /* 24 hours */ })
const PypiCoordinatesMapper = require('./pypiCoordinatesMapper')

const defaultMappers = {
  pypi: new PypiCoordinatesMapper()
}

class CoordinatesMapper {

  constructor(mappers = defaultMappers, cache = defaultcache) {
    this.mappers = mappers
    this.cache = cache
  }

  async map(coordinates) {
    const mapper = this.mappers[coordinates?.provider]
    let mapped = this.cache.get(coordinates?.toString())
    if (mapper && !mapped) {
      mapped = await mapper.map(coordinates)
      if (mapped) this.cache.set(coordinates.toString(), mapped)
    }
    return mapped || coordinates
  }
}

module.exports = (mappers, cache) => new CoordinatesMapper(mappers, cache)