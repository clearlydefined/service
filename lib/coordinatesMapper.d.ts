// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { EntityCoordinates, EntityCoordinatesSpec } from './entityCoordinates'
import { ICache } from '../providers/caching'
import { PypiCoordinatesMapper } from './pypiCoordinatesMapper'
import { GradleCoordinatesMapper } from './gradleCoordinatesMapper'

/** Interface for coordinate mappers that can transform coordinates */
export interface ICoordinatesMapper {
  /**
   * Maps coordinates to their canonical or transformed form
   *
   * @param coordinates - The coordinates to map
   * @returns Promise that resolves to mapped EntityCoordinates or the original coordinates if no mapping is needed
   */
  map(coordinates: EntityCoordinatesSpec): Promise<EntityCoordinates>
}

/** Collection of coordinate mappers indexed by provider name */
export interface CoordinatesMappers {
  /** PyPI package coordinate mapper */
  pypi?: PypiCoordinatesMapper
  /** Gradle plugin coordinate mapper */
  gradleplugin?: GradleCoordinatesMapper
  /** Additional mappers can be added for other providers */
  [provider: string]: ICoordinatesMapper | undefined
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
export declare class CoordinatesMapper {
  /** Collection of provider-specific coordinate mappers */
  private readonly mappers: CoordinatesMappers

  /** Cache instance for storing mapping results */
  private readonly cache: ICache

  /**
   * Creates a new CoordinatesMapper instance
   *
   * @param mappers - Collection of coordinate mappers indexed by provider name
   * @param cache - Cache instance for storing mapping results
   */
  constructor(mappers?: CoordinatesMappers, cache?: ICache)

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
   * @param coordinates - The coordinates to map
   * @returns Promise that resolves to mapped EntityCoordinates or the original coordinates if no mapping is available
   */
  map(coordinates: EntityCoordinatesSpec): Promise<EntityCoordinates>
}

/**
 * Factory function to create a new CoordinatesMapper instance
 *
 * @param mappers - Optional collection of coordinate mappers
 * @param cache - Optional cache instance
 * @returns A new CoordinatesMapper instance
 */
declare function createCoordinatesMapper(mappers?: CoordinatesMappers, cache?: ICache): CoordinatesMapper

export default createCoordinatesMapper
export = createCoordinatesMapper
