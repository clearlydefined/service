// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { callFetch: requestPromise } = require('../lib/fetch')
const EntityCoordinates = require('./entityCoordinates')

/**
 * @typedef {import('./fetch').FetchFunction} FetchFunction
 *
 * @typedef {import('./fetch').FetchError} FetchError
 *
 * @typedef {import('./pypiCoordinatesMapper').PypiCoordinates} PypiCoordinates
 *
 * @typedef {import('./pypiCoordinatesMapper').PypiResolutionResult} PypiResolutionResult
 *
 * @typedef {import('./entityCoordinates').default} EntityCoordinatesClass
 */

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
class PypiCoordinatesMapper {
  /**
   * Creates a new PypiCoordinatesMapper instance.
   *
   * @param {FetchFunction} [fetch=requestPromise] - Function to use for making HTTP requests. Defaults to the standard
   *   fetch implementation. Default is `requestPromise`
   */
  constructor(fetch = requestPromise) {
    /** @type {string} Base URL for PyPI API requests */
    this.baseUrl = 'https://pypi.org'
    /** @type {FetchFunction} Function Used to make HTTP requests */
    this._fetch = fetch
  }

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
   * @param {PypiCoordinates} coordinates - The coordinates to map, must include a valid package name
   * @returns {Promise<EntityCoordinatesClass | null>} Promise that resolves to EntityCoordinates with canonical name,
   *   or null if not resolvable
   * @throws {Error} When PyPI API request fails with non-404 error
   */
  async map(coordinates) {
    if (!this._shouldResolve(coordinates)) return null
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  /**
   * Determines if the given coordinates should be resolved.
   *
   * Only coordinates with names containing dots, underscores, or hyphens are considered for resolution, as these may
   * need normalization. Names containing forward slashes are rejected as invalid.
   *
   * @private
   * @param {PypiCoordinates} coordinates - The coordinates to check
   * @returns {boolean} True if the coordinates should be resolved, false otherwise
   */
  _shouldResolve(coordinates) {
    if (typeof coordinates.name !== 'string' || coordinates.name.includes('/')) return false
    return coordinates.name.includes('.') || coordinates.name.includes('_') || coordinates.name.includes('-')
  }

  /**
   * Resolves coordinates by querying the PyPI API for the canonical package name.
   *
   * @private
   * @param {PypiCoordinates} coordinates - The coordinates to resolve
   * @returns {Promise<PypiResolutionResult | null>} Promise that resolves to resolution result with canonical name, or
   *   null if not found
   * @throws {Error} When PyPI API request fails with non-404 error
   */
  async _resolve(coordinates) {
    if (coordinates.name === '..') return null
    const encodedName = encodeURIComponent(coordinates.name)
    const url = new URL(`/pypi/${encodedName}/json`, this.baseUrl).toString()
    try {
      const answer = await this._fetch({ url, method: 'GET', json: true })
      return answer?.info?.name && { name: answer.info.name }
    } catch (error) {
      if (/** @type {FetchError} */ (error).statusCode === 404) return null
      throw error
    }
  }
}

module.exports = PypiCoordinatesMapper
