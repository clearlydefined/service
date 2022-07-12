// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { values } = require('lodash')
const AbstractSearch = require('./abstractSearch')
const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')

class MemorySearch extends AbstractSearch {
  constructor(options) {
    super(options)
    this.index = {}
  }

  /**
   * Get a list of suggested coordinates that match the given pattern
   * @param {String} pattern - A pattern to look for in the coordinates of a definition
   * @returns {String[]} The list of suggested coordinates found
   */
  async suggestCoordinates(pattern) {
    const patternElements = pattern?.split('/').map(e => e.toLowerCase())
    return values(this.index)
      .filter(definition => this._isMatch(patternElements, definition.coordinates.toLowerCase()))
      .map(entry => entry.coordinates)
  }

  _isMatch(requiredParts = [], coordinates) {
    return requiredParts.every(part => coordinates.includes(part))
  }

  store(definitions) {
    const entries = this._getEntries(Array.isArray(definitions) ? definitions : [definitions])
    entries.forEach(entry => (this.index[entry.coordinates] = entry))
  }

  async query(body) {
    if (!body.count) throw new Error('unsupported query')
    return { count: Object.keys(this.index).length }
  }

  _getEntries(definitions) {
    return definitions.map(definition => {
      return {
        coordinates: EntityCoordinates.fromObject(definition.coordinates).toString(),
        releaseDate: get(definition, 'described.releaseDate'),
        declaredLicense: get(definition, 'licensed.declared'),
        discoveredLicenses: this._getLicenses(definition),
        attributionParties: this._getAttributions(definition)
      }
    })
  }

  delete(coordinates) {
    delete this.index[coordinates.toString()]
  }
}

module.exports = options => new MemorySearch(options)
