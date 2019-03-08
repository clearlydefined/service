// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const { isDeclaredLicense, setIfValue } = require('../lib/utils')

class SuggestionService {
  constructor(definitionService) {
    this.definitionService = definitionService
  }

  /**
   * Get suggestions for the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - The entity for which we are looking for suggestions
   * @returns {Suggestion} A set of suggested fixes for the definition at the given coordinates.
   * `null` is returned if no such coordinates are found.
   */
  async get(coordinates) {
    const definitions = await this._getRelatedDefinitions(coordinates)
    if (!definitions) return null
    const suggestion = { coordinates }
    this._collectSuggestionsForField(definitions, suggestion, 'licensed.declared', (definition, field) =>
      isDeclaredLicense(get(definition, field))
    )
    this._collectSuggestionsForField(definitions, suggestion, 'described.sourceLocation')
    return suggestion
  }

  /**
   * Get related definitions for the given coordinates.
   * Related here means other definitions for the same component with different revisions
   *
   * @param {EntityCoordinates} coordinates - The entity we are looking for related defintions to
   */
  async _getRelatedDefinitions(coordinates) {
    const query = { ...coordinates.asRevisionless(), sort: 'releaseDate' }
    query.namespace = query.namespace ? query.namespace : null // explicitly exclude namespace
    const results = await this.definitionService.find(query)
    const definitions = results.data
    // If the related array only has one entry then return early
    if (definitions.length <= 1) return null
    // Split the definitions into before supplied coords and those after
    const index = definitions.findIndex(entry => entry.coordinates.revision === coordinates.revision)
    if (index === -1) return null
    const before = definitions.slice(Math.max(index - 3, 0), index).reverse()
    const after = definitions.slice(index + 1, index + 3)
    return { original: definitions[index], related: before.concat(after) }
  }

  /**
   * Collect Suggestions for a given related definition and field
   * Only give suggestions if they are valid
   */
  _collectSuggestionsForField(definitions, suggestion, field, isValid = get) {
    if (isValid(definitions.original, field)) return
    setIfValue(
      suggestion,
      field,
      definitions.related
        .filter(x => isValid(x, field))
        .map(x => {
          return { value: get(x, field), version: get(x, 'coordinates.revision') }
        })
    )
  }
}

module.exports = definitionService => new SuggestionService(definitionService)
