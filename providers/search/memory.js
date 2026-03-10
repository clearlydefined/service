// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { values } = require('lodash')
const AbstractSearch = require('./abstractSearch')
const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')

class MemorySearch extends AbstractSearch {
  /**
   * @param {import('./abstractSearch').SearchOptions} options
   */
  constructor(options) {
    super(options)
    /** @type {Record<string, import('./memory').SearchEntry>} */
    this.index = {}
  }

  /**
   * Get a list of suggested coordinates that match the given pattern
   * @param {string} pattern - A pattern to look for in the coordinates of a definition
   * @returns {Promise<string[]>} The list of suggested coordinates found
   * @override
   */
  async suggestCoordinates(pattern) {
    const patternElements = pattern?.split('/').map(e => e.toLowerCase())
    return values(this.index)
      .filter(definition => this._isMatch(patternElements, definition.coordinates.toLowerCase()))
      .map(entry => entry.coordinates)
  }

  /**
   * @param {string[]} requiredParts
   * @param {string} coordinates
   */
  _isMatch(requiredParts = [], coordinates) {
    return requiredParts.every(part => coordinates.includes(part))
  }

  /**
   * @param {any} definitions
   * @override
   */
  store(definitions) {
    const entries = this._getEntries(Array.isArray(definitions) ? definitions : [definitions])
    entries.forEach(/** @param {any} entry */ entry => (this.index[entry.coordinates] = entry))
  }

  /**
   * @param {any} body
   * @override
   */
  async query(body) {
    if (!body.count) throw new Error('unsupported query')
    return { count: Object.keys(this.index).length }
  }

  /**
   * @param {any[]} definitions
   */
  _getEntries(definitions) {
    return definitions.map(
      /** @param {any} definition */ definition => {
        return {
          coordinates: EntityCoordinates.fromObject(definition.coordinates).toString(),
          releaseDate: get(definition, 'described.releaseDate'),
          declaredLicense: get(definition, 'licensed.declared'),
          discoveredLicenses: this._getLicenses(definition),
          attributionParties: this._getAttributions(definition)
        }
      }
    )
  }

  /**
   * @param {any} coordinates
   * @override
   */
  delete(coordinates) {
    delete this.index[coordinates.toString()]
  }
}

module.exports = /** @param {any} options */ options => new MemorySearch(options)
