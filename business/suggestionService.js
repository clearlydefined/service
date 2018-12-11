// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { find, findLast, get, set, sortBy, filter, concat } = require('lodash')
const EntityCoordinates = require('../lib/entityCoordinates')

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
    const baseSuggestion = this._createBaseSuggestion(coordinates)
    // create a struct with the strings in it and iterate instead
    const promises = [
      await this._collectSuggestionsForField(related, baseSuggestion, 'licensed.declared'),
      await this._collectSuggestionsForField(related, baseSuggestion, 'described.sourceLocation'),
      await this._collectSuggestionsForField(related, baseSuggestion, 'described.releaseDate')
    ]
    const result = await Promise.all(promises)
    return result
  }

  /**
   * Get related definitions for the given coordinates.
   * Related here means other definitions for the same component with different revisions
   *
   * @param {EntityCoordinates} coordinates - The entity we are looking for related defintions to
   */
  async _getRelatedDefinitions(coordinates) {
    const related = await this.definitionStore.list(coordinates.asRevisionless(), 'definitions')
    // If the related array only has one entry then return early
    if (Object.keys(related).length <= 1) {
      return
    }
    const coordinatesList = []
    related.forEach(element => {
      coordinatesList.push(EntityCoordinates.fromString(element))
    })
    const validDefinitions = await this.definitionService.getAll(coordinatesList)
    const sortedByReleaseDate = sortBy(validDefinitions, ['described.releaseDate'])

    // Split the definitions into before supplied coords and those after
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

  /**
   * Collect Suggestions for a given related definition and field
   * Only give suggestions if there is something missing
   */
  _collectSuggestionsForField(related, suggestions, field) {
    const definition = related.sortedByReleaseDate[related.index]
    // If there is already a declared licence or there are no related entries then return early
    if (get(definition, field) || !(related.before.length + related.after.length)) return []
    const before = filter(related.before, entry => get(entry, field))
    const after = filter(related.after, entry => get(entry, field))
    // Merged the before and after arrays
    const suggestionDefinitions = concat(before, after)
    set(
      suggestions,
      field,
      suggestionDefinitions.map(suggestion => {
        return { value: get(suggestion, field) }
      })
    )
    return suggestions
  }
}

module.exports = (definitionService, definitionStore) => new SuggestionService(definitionService, definitionStore)
