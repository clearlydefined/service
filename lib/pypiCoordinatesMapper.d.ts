// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { EntityCoordinates, EntityCoordinatesSpec } from './entityCoordinates'
import { FetchFunction } from './fetch'

/** Response structure from PyPI JSON API */
export interface PypiApiResponse {
  /** Information about the package */
  info?: {
    /** The canonical name of the package */
    name?: string
    /** Version of the package */
    version?: string
    /** Summary description of the package */
    summary?: string
    /** Author of the package */
    author?: string
    /** Package homepage URL */
    home_page?: string
    /** Package license information */
    license?: string
    /** Additional metadata fields */
    [key: string]: any
  }
  /** Additional response fields */
  [key: string]: any
}

/** Coordinates that can be mapped by PypiCoordinatesMapper */
export interface PypiCoordinates extends EntityCoordinatesSpec {
  /** The name of the Python package */
  name: string
  /** Optional version/revision of the package */
  revision?: string
}

/** Result of coordinate resolution containing the canonical name */
export interface PypiResolutionResult {
  /** The canonical name of the package as returned by PyPI */
  name: string
}

/**
 * Maps Python package coordinates to their canonical forms using the PyPI API.
 *
 * This class handles the normalization of Python package names by querying the PyPI JSON API to get the canonical name
 * format. Python package names can use different separators (dots, underscores, hyphens) but PyPI stores them in a
 * canonical format.
 *
 * @example
 *   ```javascript
 *   const mapper = new PypiCoordinatesMapper();
 *   const coordinates = { name: 'my-package', type: 'pypi' };
 *   const resolved = await mapper.map(coordinates);
 *   console.log(resolved.name); // May be different from input if normalized
 *   ```
 */
export declare class PypiCoordinatesMapper {
  /** Base URL for PyPI API requests */
  readonly baseUrl: string

  /** Function used to make HTTP requests */
  private readonly _fetch: FetchFunction

  /**
   * Creates a new PypiCoordinatesMapper instance.
   *
   * @param fetch - Function to use for making HTTP requests. Defaults to the standard fetch implementation.
   */
  constructor(fetch?: FetchFunction)

  /**
   * Maps coordinates to their canonical form by resolving the package name through PyPI.
   *
   * @example
   *   ```javascript
   *   const coordinates = { name: 'my_package-name', type: 'pypi' };
   *   const resolved = await mapper.map(coordinates);
   *   // resolved.name might be 'my-package-name' (canonical form)
   *   ```
   *
   * @param coordinates - The coordinates to map, must include a valid package name
   * @returns Promise that resolves to EntityCoordinates with canonical name, or null if not resolvable
   * @throws {Error} When PyPI API request fails with non-404 error
   */
  map(coordinates: PypiCoordinates): Promise<EntityCoordinates | null>

  /**
   * Determines if the given coordinates should be resolved.
   *
   * Only coordinates with names containing dots, underscores, or hyphens are considered for resolution, as these may
   * need normalization. Names containing forward slashes are rejected as invalid.
   *
   * @param coordinates - The coordinates to check
   * @returns True if the coordinates should be resolved, false otherwise
   */
  private _shouldResolve(coordinates: PypiCoordinates): boolean

  /**
   * Resolves coordinates by querying the PyPI API for the canonical package name.
   *
   * @param coordinates - The coordinates to resolve
   * @returns Promise that resolves to resolution result with canonical name, or null if not found
   * @throws {Error} When PyPI API request fails with non-404 error
   */
  private _resolve(coordinates: PypiCoordinates): Promise<PypiResolutionResult | null>
}

export default PypiCoordinatesMapper
