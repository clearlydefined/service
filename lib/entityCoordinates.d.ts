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

/** Represents entity coordinates for a software component */
export declare class EntityCoordinates implements EntityCoordinatesSpec {
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
export = EntityCoordinates
