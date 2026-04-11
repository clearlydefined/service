// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from '../providers/caching/index.js'
import memoryCache from '../providers/caching/memory.ts'
import type { EntityCoordinates, EntityCoordinatesSpec } from './entityCoordinates.ts'
import type { GradleCoordinatesMapper } from './gradleCoordinatesMapper.ts'
import GradleCoordinatesMapperImpl from './gradleCoordinatesMapper.ts'
import type { PypiCoordinatesMapper } from './pypiCoordinatesMapper.ts'
import PypiCoordinatesMapperImpl from './pypiCoordinatesMapper.ts'

const defaultcache = memoryCache({ defaultTtlSeconds: 60 * 60 * 24 /* 24 hours */ })

/** Interface for coordinate mappers that can transform coordinates */
export interface ICoordinatesMapper {
  map(coordinates: EntityCoordinatesSpec): Promise<EntityCoordinates | null>
}

/** Collection of coordinate mappers indexed by provider name */
export interface CoordinatesMappers {
  pypi?: PypiCoordinatesMapper
  gradleplugin?: GradleCoordinatesMapper
  [provider: string]: ICoordinatesMapper | undefined
}

/** Default Collection of coordinate mappers */
const defaultMappers: CoordinatesMappers = {
  pypi: new PypiCoordinatesMapperImpl(),
  gradleplugin: new GradleCoordinatesMapperImpl()
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
  mappers: CoordinatesMappers
  cache: ICache

  /**
   * Creates a new CoordinatesMapper instance
   */
  constructor(mappers: CoordinatesMappers = defaultMappers, cache: ICache = defaultcache) {
    /** @type {CoordinatesMappers} Collection of provider-specific coordinate mappers */
    this.mappers = mappers
    /** @type {ICache} Cache instance for storing mapping results */
    this.cache = cache
  }

  /**
   * Maps coordinates using the appropriate provider-specific mapper.
   */
  async map(coordinates: EntityCoordinates | undefined): Promise<EntityCoordinates | undefined> {
    if (!coordinates) {
      return undefined
    }
    // biome-ignore lint/style/noNonNullAssertion: provider may be undefined but mappers index handles it
    const mapper = this.mappers[coordinates.provider!]
    let mapped = await Promise.resolve(this.cache.get(coordinates.toString()))
    if (mapper && !mapped) {
      mapped = await mapper.map(coordinates)
      if (mapped) {
        await Promise.resolve(this.cache.set(coordinates.toString(), mapped))
      }
    }
    return mapped || coordinates
  }
}

/**
 * Factory function to create a new CoordinatesMapper instance
 */
export default (mappers?: CoordinatesMappers, cache?: ICache) => new CoordinatesMapper(mappers, cache)
