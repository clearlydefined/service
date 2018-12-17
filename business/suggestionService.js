// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, set, sortBy, filter, concat } = require('lodash')
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
      await this._collectSuggestionsForField(related, baseSuggestion, 'described.releaseDate'),
      await this._collectSuggestionsForFiles(related, baseSuggestion)
    ]
    await Promise.all(promises)
    return baseSuggestion
  }

  /**
   * Get related definitions for the given coordinates.
   * Related here means other definitions for the same component with different revisions
   *
   * @param {EntityCoordinates} coordinates - The entity we are looking for related defintions to
   */
  async _getRelatedDefinitions(coordinates) {
    const related = await this.definitionService.list(coordinates.asRevisionless(), true)
    // If the related array only has one entry then return early
    if (Object.keys(related).length <= 1) return
    const validDefinitions = await this.definitionService.getAll(
      related.map(element => EntityCoordinates.fromString(element))
    )
    const sortedByReleaseDate = sortBy(validDefinitions, ['described.releaseDate'])
    // Split the definitions into before supplied coords and those after
    const index = sortedByReleaseDate.findIndex(entry => entry.coordinates.revision === coordinates.revision)
    if (index === -1) return null
    const before = sortedByReleaseDate.slice(Math.max(index - 3, 0), index).reverse()
    const after = sortedByReleaseDate.slice(index + 1, index + 3)
    return { sortedByReleaseDate, index, before, after }
  }

  _createBaseSuggestion(coordinates) {
    return { coordinates }
  }

  /**
   * Collect Suggestions for a given related definition and field
   * Only give suggestions if there is something missing
   */
  async _collectSuggestionsForField(related, suggestions, field) {
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
        return { value: get(suggestion, field), version: get(suggestion, 'coordinates.revision') }
      })
    )
    return suggestions
  }

  /**
   * Collect Suggestions for all the files of the definition
   * Only give suggestions if there is something missing
   */
  async _collectSuggestionsForFiles(related, suggestions) {
    const definition = related.sortedByReleaseDate[related.index]
    if (!get(definition, 'files')) return null
    //Find the same file in related definitions
    const promises = definition.files.map(async file => {
      if (get(file, 'license') && get(file, 'attributions')) return null
      const filesSuggestions = await this._collectSuggestionsForFile(related, file.path)
      return { path: file.path, licence: filesSuggestions.license, attributions: filesSuggestions.attributions }
    })
    const result = await Promise.all(promises)
    set(suggestions, 'files', result)
    return suggestions
  }

  async _collectSuggestionsForFile(related, filePath) {
    // Search same path in related definitions
    const before = filter(related.before, entry => get(entry, 'files'))
    const after = filter(related.after, entry => get(entry, 'files'))
    // Consider only same path in related definitions
    const suggestionDefinitions = concat(before, after).map(definition => {
      return { ...definition, file: definition.files.find(file => file.path === filePath) }
    })
    if (suggestionDefinitions.length === 0) return null
    return {
      license: suggestionDefinitions.map(suggestion => {
        return { value: get(suggestion, 'file.license'), version: get(suggestion, 'coordinates.revision') }
      }),
      attributions: suggestionDefinitions.map(suggestion => {
        return { value: get(suggestion, 'file.attributions'), version: get(suggestion, 'coordinates.revision') }
      })
    }
  }
}

module.exports = (definitionService, definitionStore) => new SuggestionService(definitionService, definitionStore)
