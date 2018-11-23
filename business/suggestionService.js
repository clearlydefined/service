// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { find, findLast, get, set } = require('lodash')

class SuggestionService {
  constructor(definitionService, definitionStore) {
    this.definitionService = definitionService
    this.definitionStore = definitionStore
  }

  /**
   * Get suggestions for the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - The entity for which we are looking for suggestions
   * @returns {Suggestion} A set of suggested fixes for the definition at the given coordinates.
   * `null` is returned if no such coordinates are found.
   */
  async get(coordinates) {
    const related = await this._getRelatedDefinitions(coordinates)
    if (!related) return null
    const result = this._createBaseSuggestion(coordinates)
    await this._collectLicenseSuggestions(related, result)
    return result
  }

  async _getRelatedDefinitions(coordinates) {
    const related = await this.definitionStore.list(coordinates.asRevisionless(), 'definitions')
    const sorted = related.sort((one, two) => (one.described.releaseDate > two.described.releaseDate ? 1 : -1))
    const index = sorted.findIndex(entry => entry.coordinates.revision === coordinates.revision)
    if (index === -1) return null
    const before = sorted.slice(Math.max(index - 3, 0), index).reverse()
    const after = sorted.slice(index + 1, index + 3)
    return { sorted, index, before, after }
  }

  _createBaseSuggestion(coordinates) {
    return {
      coordinates: coordinates
    }
  }

  _collectLicenseSuggestions(related, suggestions) {
    // for now only do suggestions if there is something missing
    const definition = related.sorted[related.index]
    if (get(definition, 'licensed.declared') || !(related.before.length + related.after.length)) return
    const before = findLast(related.before, entry => get(entry, 'licensed.declared'))
    const after = find(related.after, entry => get(entry, 'licensed.declared'))
    const suggestionDefinitions = [before, after].filter(x => x)
    const suggestionObjects = suggestionDefinitions.map(suggestion => suggestion.licensed.declared)
    set(suggestions, 'licensed.declared', suggestionObjects)
  }
}

module.exports = (definitionService, definitionStore) => new SuggestionService(definitionService, definitionStore)
