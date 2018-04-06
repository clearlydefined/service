// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, uniq, values } = require('lodash')
const base64 = require('base-64')
const EntityCoordinates = require('../../lib/entityCoordinates')

class AbstractSearch {
  constructor(options) {
    this.options = options
  }

  async initialize() {}

  /**
   * Get the results of running the tool specified in the coordinates on the entty specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {ResultCoordinates} coordinates - The coordinates of the result to get
   * @returns The object found at the given coordinates
   */
  async get(pattern) {}

  /**
   * Get a list of suggested coordinates that match the given pattern
   * @param {String} pattern - A pattern to look for in the coordinates of a definition
   * @returns {String[]} The list of suggested coordinates found
   */
  async suggestCoordinates(pattern) {
    return []
  }

  _getLicenses(definition) {
    const facets = get(definition, 'licensed.facets')
    if (!facets) return []
    // TODO probably need to use a better comparison here that compares actual expressions rather than just the strings
    return uniq(
      values(facets).reduce((result, facet) => result.concat(get(facet, 'discovered.expressions')), [])
    ).filter(e => e)
  }

  _getAttributions(definition) {
    const facets = get(definition, 'licensed.facets')
    if (!facets) return []
    return uniq(values(facets).reduce((result, facet) => result.concat(get(facet, 'attribution.parties')), [])).filter(
      e => e
    )
  }

  _getEntry(definition) {
    const coordinatesString = EntityCoordinates.fromObject(definition.coordinates).toString()
    return {
      '@search.action': 'upload',
      key: base64.encode(coordinatesString),
      coordinates: coordinatesString,
      releaseDate: get(definition, 'described.releaseDate'),
      declaredLicense: get(definition, 'licensed.declared'),
      discoveredLicenses: this._getLicenses(definition),
      attributionParties: this._getAttributions(definition)
    }
  }

  store(definition) {}

  delete(coordinates) {}
}

module.exports = AbstractSearch
