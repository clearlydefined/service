// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, uniq, values } = require('lodash')

class AbstractSearch {
  /**
   * @param {import('./abstractSearch').SearchOptions} options
   */
  constructor(options) {
    this.options = options
  }

  async initialize() {}

  /**
   * Get the results of running the tool specified in the coordinates on the entity specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {any} _coordinates - The coordinates of the result to get
   * @returns The object found at the given coordinates
   */
  // eslint-disable-next-line no-unused-vars
  async get(_coordinates) {}

  /**
   * Get a list of suggested coordinates that match the given pattern
   * @param {string} _pattern - A pattern to look for in the coordinates of a definition
   * @returns {Promise<string[]>} The list of suggested coordinates found
   */
  // eslint-disable-next-line no-unused-vars
  async suggestCoordinates(_pattern) {
    return []
  }

  /**
   * @param {any} definition
   */
  _getLicenses(definition) {
    const facets = get(definition, 'licensed.facets')
    if (!facets) return []
    // TODO probably need to use a better comparison here that compares actual expressions rather than just the strings
    return uniq(
      values(facets).reduce((result, facet) => result.concat(get(facet, 'discovered.expressions')), [])
    ).filter(e => e)
  }

  /**
   * @param {any} definition
   */
  _getAttributions(definition) {
    const facets = get(definition, 'licensed.facets')
    if (!facets) return []
    return uniq(values(facets).reduce((result, facet) => result.concat(get(facet, 'attribution.parties')), [])).filter(
      e => e
    )
  }

  /**
   * Add the given definition to the index
   *
   * @param {any} _definition
   */
  // eslint-disable-next-line no-unused-vars
  store(_definition) {}

  /**
   * Query the definitions in the index
   *
   * @param {any} _body
   */
  // eslint-disable-next-line no-unused-vars
  query(_body) {
    return {}
  }

  /**
   * Remove the given definition from the index
   *
   * @param {any} _coordinates
   */
  // eslint-disable-next-line no-unused-vars
  delete(_coordinates) {}
}

module.exports = AbstractSearch
