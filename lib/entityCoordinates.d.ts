// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** Represents the specification object used to create EntityCoordinates */
export interface EntityCoordinatesSpec {
  type?: string
  provider?: string
  namespace?: string
  name?: string
  revision?: string
}

/** Supported providers that have specific normalization rules */
export type SupportedProvider = 'github' | 'pypi'

/** Property flags used for normalization bitmasks */
export type PropertyFlag = 0x1 | 0x2 | 0x4

/** Map of providers to their normalization rules */
export interface ToLowerCaseMap {
  [key: string]: number
  github: number
  pypi: number
}

/**
 * Normalizes a value based on provider-specific rules
 *
 * @param value - The value to normalize
 * @param provider - The provider name
 * @param property - The property flag to check against
 * @returns The normalized value or the original value if no normalization is needed
 */
declare function normalize(value: string | undefined, provider: string, property: PropertyFlag): string | undefined

/** Represents entity coordinates for a software component */
declare class EntityCoordinates {
  /** The type of the entity (e.g., 'npm', 'maven', 'git') */
  type?: string

  /** The provider of the entity (e.g., 'npmjs', 'mavencentral', 'github') */
  provider?: string

  /** The namespace of the entity (optional, depends on provider) */
  namespace?: string

  /** The name of the entity */
  name?: string

  /** The revision/version of the entity */
  revision?: string

  /**
   * Creates EntityCoordinates from a specification object
   *
   * @param spec - The specification object or existing EntityCoordinates instance
   * @returns New EntityCoordinates instance or null if spec is falsy
   */
  static fromObject(spec: EntityCoordinatesSpec | EntityCoordinates | null | undefined): EntityCoordinates | null

  /**
   * Creates EntityCoordinates from a path string
   *
   * @param path - Path string in format "type/provider/namespace/name/revision"
   * @returns New EntityCoordinates instance or null if path is invalid
   */
  static fromString(path: string | null | undefined): EntityCoordinates | null

  /**
   * Creates EntityCoordinates from a URN string
   *
   * @param urn - URN string in format "scheme:type:provider:namespace:name:rev:revision"
   * @returns New EntityCoordinates instance or null if urn is invalid
   */
  static fromUrn(urn: string | null | undefined): EntityCoordinates | null

  /**
   * Creates a new EntityCoordinates instance
   *
   * @param type - The type of the entity
   * @param provider - The provider of the entity
   * @param namespace - The namespace of the entity (optional)
   * @param name - The name of the entity
   * @param revision - The revision/version of the entity (optional)
   */
  constructor(type?: string, provider?: string, namespace?: string, name?: string, revision?: string)

  /**
   * Converts the coordinates to a string representation
   *
   * @returns String representation in format "type/provider/namespace/name/revision"
   */
  toString(): string

  /**
   * Creates a copy of the coordinates without the revision
   *
   * @returns New EntityCoordinates instance without revision
   */
  asRevisionless(): EntityCoordinates

  /**
   * Returns this instance (identity function for compatibility)
   *
   * @returns This EntityCoordinates instance
   */
  asEntityCoordinates(): EntityCoordinates
}

export default EntityCoordinates
