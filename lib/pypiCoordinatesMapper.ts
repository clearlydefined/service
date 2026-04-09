// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { callFetch as requestPromise } from '../lib/fetch.ts'
import type { EntityCoordinatesSpec } from './entityCoordinates.ts'
import EntityCoordinates from './entityCoordinates.ts'
import type { FetchError, FetchFunction } from './fetch.ts'

/** Coordinates that can be mapped by PypiCoordinatesMapper */
export interface PypiCoordinates extends EntityCoordinatesSpec {
  name: string
  revision?: string
}

/** Result of coordinate resolution containing the canonical name */
export interface PypiResolutionResult {
  name: string
}

/**
 * Maps Python package coordinates to their canonical forms using the PyPI API.
 */
export class PypiCoordinatesMapper {
  readonly baseUrl: string
  private readonly _fetch: FetchFunction

  /**
   * Creates a new PypiCoordinatesMapper instance.
   */
  constructor(fetch: FetchFunction = requestPromise) {
    this.baseUrl = 'https://pypi.org'
    this._fetch = fetch
  }

  /**
   * Maps coordinates to their canonical form by resolving the package name through PyPI.
   */
  async map(coordinates: PypiCoordinates): Promise<EntityCoordinates | null> {
    if (!this._shouldResolve(coordinates)) {
      return null
    }
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  /**
   * Determines if the given coordinates should be resolved.
   */
  _shouldResolve(coordinates: PypiCoordinates): boolean {
    if (typeof coordinates.name !== 'string' || coordinates.name.includes('/')) {
      return false
    }
    return coordinates.name.includes('.') || coordinates.name.includes('_') || coordinates.name.includes('-')
  }

  /**
   * Resolves coordinates by querying the PyPI API for the canonical package name.
   */
  async _resolve(coordinates: PypiCoordinates): Promise<PypiResolutionResult | null> {
    if (coordinates.name === '..') {
      return null
    }
    const encodedName = encodeURIComponent(coordinates.name)
    const url = new URL(`/pypi/${encodedName}/json`, this.baseUrl).toString()
    try {
      const answer = await this._fetch({ url, method: 'GET', json: true })
      return answer?.info?.name && { name: answer.info.name }
    } catch (error) {
      if ((error as FetchError).statusCode === 404) {
        return null
      }
      throw error
    }
  }
}

export default PypiCoordinatesMapper
