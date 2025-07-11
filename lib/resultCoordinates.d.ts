// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { EntityCoordinates, EntityCoordinatesSpec } from './entityCoordinates'

/** Represents the specification object used to create ResultCoordinates */
export interface ResultCoordinatesSpec extends EntityCoordinatesSpec {
  tool?: string
  toolVersion?: string
}

/** Represents result coordinates for a software component with associated tool information */
export declare class ResultCoordinates {
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

  /** The tool used to analyze the entity (e.g., 'clearlydefined', 'scancode') */
  tool?: string

  /** The version of the tool used to analyze the entity */
  toolVersion?: string

  /**
   * Creates ResultCoordinates from a specification object
   *
   * @param spec - The specification object or existing ResultCoordinates instance
   * @returns New ResultCoordinates instance or null if spec is falsy
   */
  static fromObject(spec: ResultCoordinatesSpec | ResultCoordinates | null | undefined): ResultCoordinates | null

  /**
   * Creates ResultCoordinates from a path string
   *
   * @param path - Path string in format "type/provider/namespace/name/revision/tool/toolVersion"
   * @returns New ResultCoordinates instance or null if path is invalid
   */
  static fromString(path: string | null | undefined): ResultCoordinates | null

  /**
   * Creates ResultCoordinates from a URN string
   *
   * @param urn - URN string in format "scheme:type:provider:namespace:name:revision:revision:tool:tool:toolVersion"
   * @returns New ResultCoordinates instance or null if urn is invalid
   */
  static fromUrn(urn: string | null | undefined): ResultCoordinates | null

  /**
   * Creates a new ResultCoordinates instance
   *
   * @param type - The type of the entity
   * @param provider - The provider of the entity
   * @param namespace - The namespace of the entity (optional)
   * @param name - The name of the entity
   * @param revision - The revision/version of the entity
   * @param tool - The tool used to analyze the entity
   * @param toolVersion - The version of the tool used to analyze the entity
   */
  constructor(
    type?: string,
    provider?: string,
    namespace?: string,
    name?: string,
    revision?: string,
    tool?: string,
    toolVersion?: string
  )

  /**
   * Converts the coordinates to a string representation
   *
   * @returns String representation in format "type/provider/namespace/name/revision/tool/toolVersion"
   */
  toString(): string

  /**
   * Converts the result coordinates to entity coordinates (without tool information)
   *
   * @returns New EntityCoordinates instance representing the same entity
   */
  asEntityCoordinates(): EntityCoordinates
}

export default ResultCoordinates
export = ResultCoordinates
