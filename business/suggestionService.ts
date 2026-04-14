// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../lib/entityCoordinates.ts'
import type { DefinitionService, SourceLocation } from './definitionService.ts'

import lodash from 'lodash'

const { get } = lodash

import { compareDates, isDeclaredLicense, setIfValue } from '../lib/utils.ts'

/** A suggested value with the version it came from */
export interface SuggestionValue<T> {
  value: T
  version: string
}

/** Suggestion object containing suggested fixes for a definition */
export interface Suggestion {
  coordinates: EntityCoordinates
  'licensed.declared'?: SuggestionValue<string>[]
  'described.sourceLocation'?: SuggestionValue<SourceLocation>[]
}

/** Related definitions result */
export interface RelatedDefinitions {
  original: any
  related: any[]
}

/**
 * Service for generating suggestions to improve definitions.
 * Analyzes related versions and discovered data to suggest curations.
 */
class SuggestionService {
  definitionService: DefinitionService

  constructor(definitionService: DefinitionService) {
    this.definitionService = definitionService
  }

  /**
   * Get suggestions for the given coordinates.
   * `null` is returned if no such coordinates are found.
   */
  async get(coordinates: EntityCoordinates): Promise<Suggestion | null> {
    const definitions = await this._getRelatedDefinitions(coordinates)
    if (!definitions) {
      return null
    }
    let hasSuggested = false
    const suggestion: Suggestion = { coordinates }
    if (Array.isArray(definitions.related) && definitions.related.length > 0) {
      hasSuggested = this._collectSuggestionsForField(
        definitions,
        suggestion,
        'licensed.declared',
        (definition, field) => isDeclaredLicense(get(definition, field))
      )
      hasSuggested =
        hasSuggested || this._collectSuggestionsForField(definitions, suggestion, 'described.sourceLocation')
    }

    if (!isDeclaredLicense(get(definitions.original, 'licensed.declared'))) {
      const discoveredExpressions = get(definitions.original, 'licensed.facets.core.discovered.expressions')
      if (Array.isArray(discoveredExpressions)) {
        const appendDeclared = discoveredExpressions.filter(isDeclaredLicense).map(value => {
          return { value, version: get(definitions.original, 'coordinates.revision') }
        })
        const suggestedSoFar = get(suggestion, 'licensed.declared') || []
        hasSuggested =
          hasSuggested ||
          setIfValue(
            suggestion,
            'licensed.declared',
            appendDeclared.concat(suggestedSoFar).filter((v, i, a) => a.indexOf(v) === i)
          )
      }
    }

    return hasSuggested ? suggestion : null
  }

  /**
   * Get related definitions for the given coordinates.
   * Related here means other definitions for the same component with different revisions
   */
  async _getRelatedDefinitions(coordinates: EntityCoordinates): Promise<RelatedDefinitions | null> {
    const query = coordinates.asRevisionless()
    query.namespace = query.namespace ? query.namespace : null // explicitly exclude namespace
    const results = await this.definitionService.find(query)
    const definitions = results.data.sort((a, b) =>
      compareDates(get(a, 'described.releaseDate'), get(b, 'described.releaseDate'))
    )
    // If the related array only has one entry then return early
    if (definitions.length < 1) {
      return null
    }
    // Split the definitions into before supplied coords and those after
    const index = definitions.findIndex(entry => entry.coordinates.revision === coordinates.revision)
    if (index === -1) {
      return null
    }
    const before = definitions.slice(Math.max(index - 3, 0), index).reverse()
    const after = definitions.slice(index + 1, index + 3)
    return { original: definitions[index], related: before.concat(after) }
  }

  /**
   * Collect Suggestions for a given related definition and field.
   * Only give suggestions if they are valid.
   */
  _collectSuggestionsForField(
    definitions: RelatedDefinitions,
    suggestion: Suggestion,
    field: string,
    isValid: (definition: any, field: string) => any = get
  ): boolean {
    if (isValid(definitions.original, field)) {
      return false
    }
    return setIfValue(
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

export default (definitionService: DefinitionService): SuggestionService => new SuggestionService(definitionService)
