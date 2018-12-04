// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { find, findLast, get, set, sortBy } = require('lodash')

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

  // All the related contents correspond to other definitions in harvested-data-definition
  // The only differentiator for now is the revision and using mock test data
  async _getRelatedDefinitions(coordinates) {
    const related = await this.definitionStore.list(coordinates.asRevisionless(), 'definitions')
    // If the related array only has one entry then return early (lodash isEmpty won't work)
    if (Object.keys(related).length <= 1) {
      return
    }
    // Create a coordinatesList from the array of strings
    const coordinatesList = []
    related.forEach(element => {
      coordinatesList.push(EntityCoordinates.fromString(element))
    })
    // Get all the definition entries available for the given coordinates (down to the revision)
    const validDefinitions = await this.definitionService.getAll(coordinatesList)
    const sortedByReleaseDate = sortBy(validDefinitions, ['described.releaseDate'])

    // Now just split the definitions to those before supplied coords and those after
    const index = sortedByReleaseDate.findIndex(entry => entry.coordinates.revision === coordinates.revision)
    if (index === -1) return null
    const before = sortedByReleaseDate.slice(Math.max(index - 3, 0), index).reverse()
    const after = sortedByReleaseDate.slice(index + 1, index + 3)
    return { sortedByReleaseDate, index, before, after }
  }

  _createBaseSuggestion(coordinates) {
    return {
      coordinates: coordinates
    }
  }

  _collectLicenseSuggestions(related, suggestions) {
    // for now only do suggestions if there is something missing
    const definition = related.sortedByReleaseDate[related.index]
    if (get(definition, 'licensed.declared') || !(related.before.length + related.after.length)) return
    const before = findLast(related.before, entry => get(entry, 'licensed.declared'))
    const after = find(related.after, entry => get(entry, 'licensed.declared'))
    const suggestionDefinitions = [before, after].filter(x => x)
    const suggestionObjects = suggestionDefinitions.map(suggestion => suggestion.licensed.declared)
    // Add the second object to the original object
    set(suggestions, 'licensed.declared', suggestionObjects)
  }
}

module.exports = (definitionService, definitionStore) => new SuggestionService(definitionService, definitionStore)
