// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const defaultcache = require('../providers/caching/memory')({ defaultTtlSeconds: 60 * 60 * 24 /* 24 hours */ })
const PypiCoordinatesMapper = require('./pypiCoordinatesMapper')
const GradleCoordinatesMapper = require('./gradleCoordinatesMapper')

/**
 * @typedef {import('./coordinatesMapper').ICoordinatesMapper} ICoordinatesMapper
 *
 * @typedef {import('./coordinatesMapper').CoordinatesMappers} CoordinatesMappers
 *
 * @typedef {import('./entityCoordinates').EntityCoordinatesSpec} EntityCoordinatesSpec
 *
 * @typedef {import('./entityCoordinates').default} EntityCoordinates
 *
 * @typedef {import('../providers/caching').ICache} ICache
 */

/** @type {CoordinatesMappers} Default Collection of coordinate mappers */
const defaultMappers = {
  pypi: new PypiCoordinatesMapper(),
  gradleplugin: new GradleCoordinatesMapper()
}

/**
 * Main coordinate mapping service that delegates to provider-specific mappers.
 *
 * This class manages a collection of coordinate mappers for different package providers and handles caching of mapping
 * results. It serves as the central point for coordinate transformation across the system.
 *
 * @example
 *   ```javascript
 *   const mapper = new CoordinatesMapper();
 *   const coordinates = { type: 'pypi', provider: 'pypi', name: 'my_package' };
 *   const mapped = await mapper.map(coordinates);
 *   console.log(mapped.name); // May be normalized/canonicalized
 *   ```
 */
class CoordinatesMapper {
  /**
   * Creates a new CoordinatesMapper instance
   *
   * @param {CoordinatesMappers} [mappers=defaultMappers] - Collection of coordinate mappers indexed by provider name.
   *   Default is `defaultMappers`
   * @param {ICache} [cache=defaultcache] - Cache instance for storing mapping results. Default is `defaultcache`
   */
  constructor(mappers = defaultMappers, cache = defaultcache) {
    /** @type {CoordinatesMappers} Collection of provider-specific coordinate mappers */
    this.mappers = mappers
    /** @type {ICache} Cache instance for storing mapping results */
    this.cache = cache
  }

  /**
   * Maps coordinates using the appropriate provider-specific mapper.
   *
   * This method:
   *
   * 1. Checks the cache for existing mapping results
   * 2. Delegates to the appropriate provider-specific mapper if no cache hit
   * 3. Caches successful mapping results
   * 4. Returns the mapped coordinates or the original coordinates if no mapper is available
   *
   * @param {EntityCoordinatesSpec} coordinates - The coordinates to map
   * @returns {Promise<EntityCoordinates>} Promise that resolves to mapped EntityCoordinates or the original coordinates
   *   if no mapping is available
   */
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

/**
 * Factory function to create a new CoordinatesMapper instance
 *
 * @param {CoordinatesMappers} [mappers] - Optional collection of coordinate mappers
 * @param {ICache} [cache] - Optional cache instance
 * @returns {CoordinatesMapper} A new CoordinatesMapper instance
 */
module.exports = (mappers, cache) => new CoordinatesMapper(mappers, cache)
