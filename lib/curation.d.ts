// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from './entityCoordinates'
import type { Definition } from './utils'

/** Error entry from curation validation */
export interface CurationError {
  message: string
  error: unknown
}

/** Coordinates section of curation data */
export interface CurationCoordinates {
  type?: string
  provider?: string
  namespace?: string
  name?: string
}

/** File-level curation data */
export interface CurationFileEntry {
  path: string
  license?: string
  attributions?: string[]
}

/** Revision-level curation data */
export interface CurationRevision {
  licensed?: {
    declared?: string
  }
  described?: {
    releaseDate?: string
    sourceLocation?: {
      type?: string
      provider?: string
      namespace?: string
      name?: string
      revision?: string
      url?: string
    }
  }
  files?: CurationFileEntry[]
}

/** Full curation data structure */
export interface CurationData {
  coordinates?: CurationCoordinates
  revisions?: Record<string, CurationRevision>
}

/**
 * Represents a curation document that can be applied to definitions
 */
declare class Curation {
  /** Validation errors encountered during loading/validation */
  errors: CurationError[]

  /** Whether the curation passed validation */
  isValid: boolean

  /** Path of the curation file */
  path: string

  /** Parsed curation data */
  data: CurationData | undefined

  /** Whether validation should be performed */
  shouldValidate: boolean

  /**
   * Creates a new Curation instance
   * @param content - YAML string or parsed curation data object
   * @param path - Optional file path for error reporting
   * @param validate - Whether to validate the curation (default: true)
   */
  constructor(content: string | CurationData, path?: string, validate?: boolean)

  /**
   * Applies a curation to a definition
   * @param definition - The definition to modify
   * @param curation - The curation revision data to apply
   * @returns The modified definition
   */
  static apply(definition: Definition, curation: CurationRevision): Definition

  /**
   * Gets all coordinates from multiple curations
   * @param curations - Array of Curation instances
   * @returns Array of all EntityCoordinates from all curations
   */
  static getAllCoordinates(curations: Curation[]): EntityCoordinates[]

  /**
   * Loads YAML content into curation data
   * @param content - YAML string to parse
   * @returns Parsed curation data or undefined on error
   */
  load(content: string): CurationData | undefined

  /**
   * Validates the curation data against schema and SPDX compliance
   */
  validate(): void

  /**
   * Gets EntityCoordinates for all revisions in this curation
   * @returns Array of EntityCoordinates, one per revision
   */
  getCoordinates(): EntityCoordinates[]
}

export default Curation
export = Curation
