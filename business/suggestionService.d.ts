// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../lib/entityCoordinates'
import type { DefinitionService, SourceLocation } from './definitionService'

/** A suggested value with the version it came from */
export interface SuggestionValue<T> {
  /** The suggested value */
  value: T
  /** The version this suggestion came from */
  version: string
}

/** Suggestion object containing suggested fixes for a definition */
export interface Suggestion {
  /** Coordinates of the component being suggested for */
  coordinates: EntityCoordinates
  /** Suggested declared license values */
  'licensed.declared'?: SuggestionValue<string>[]
  /** Suggested source location values */
  'described.sourceLocation'?: SuggestionValue<SourceLocation>[]
}

/** Related definitions result */
export interface RelatedDefinitions {
  /** The original definition for the requested coordinates */
  original: any
  /** Related definitions from other versions */
  related: any[]
}

/**
 * Service for generating suggestions to improve definitions.
 * Analyzes related versions and discovered data to suggest curations.
 */
export declare class SuggestionService {
  /** Definition service instance */
  protected definitionService: DefinitionService

  /**
   * Creates a new SuggestionService instance
   *
   * @param definitionService - The definition service to use for lookups
   */
  constructor(definitionService: DefinitionService)

  /**
   * Get suggestions for the given coordinates.
   *
   * @param coordinates - The entity for which we are looking for suggestions
   * @returns A set of suggested fixes for the definition, or null if not found
   */
  get(coordinates: EntityCoordinates): Promise<Suggestion | null>
}

/**
 * Factory function to create a SuggestionService instance
 *
 * @param definitionService - The definition service to use
 * @returns A new SuggestionService instance
 */
declare function createSuggestionService(definitionService: DefinitionService): SuggestionService

export default createSuggestionService
export = createSuggestionService
