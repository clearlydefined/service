// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { values } = require('lodash')
const AbstractSearch = require('./abstractSearch')

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
    return values(this.index).filter(definition => definition.coordinates.includes(pattern))
  }

  store(coordinates, definition) {
    const entry = this._getEntry(coordinates, definition)
    this.index[coordinates.toString()] = entry
  }

  delete(coordinates) {
    delete this.index[coordinates.toString()]
  }
}

module.exports = options => new MemorySearch(options)
