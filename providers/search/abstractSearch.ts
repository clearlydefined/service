// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { Definition } from '../../business/definitionService.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'

const { get, uniq, values } = lodash

export interface SearchOptions {
  [key: string]: any
}

class AbstractSearch {
  declare options: SearchOptions
  constructor(options: SearchOptions) {
    this.options = options
  }

  async initialize() {}

  /**
   * Get the results of running the tool specified in the coordinates on the entity specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   */
  // eslint-disable-next-line no-unused-vars
  async get(_coordinates: EntityCoordinates): Promise<Definition | null> {
    return null
  }

  /**
   * Get a list of suggested coordinates that match the given pattern
   */
  // eslint-disable-next-line no-unused-vars
  async suggestCoordinates(_pattern: string): Promise<string[]> {
    return []
  }

  _getLicenses(definition: Definition): string[] {
    const facets = get(definition, 'licensed.facets')
    if (!facets) {
      return []
    }
    // TODO probably need to use a better comparison here that compares actual expressions rather than just the strings
    return uniq(
      values(facets).reduce((result, facet) => result.concat(get(facet, 'discovered.expressions')), [])
    ).filter(e => e)
  }

  _getAttributions(definition: Definition): string[] {
    const facets = get(definition, 'licensed.facets')
    if (!facets) {
      return []
    }
    return uniq(values(facets).reduce((result, facet) => result.concat(get(facet, 'attribution.parties')), [])).filter(
      e => e
    )
  }

  /**
   * Add the given definition to the index
   */
  // eslint-disable-next-line no-unused-vars
  store(_definition: Definition) {}

  /**
   * Query the definitions in the index
   */
  // eslint-disable-next-line no-unused-vars
  query(_body: Record<string, unknown>): unknown {
    return {}
  }

  /**
   * Remove the given definition from the index
   */
  // eslint-disable-next-line no-unused-vars
  delete(_coordinates: EntityCoordinates) {}
}

export default AbstractSearch
