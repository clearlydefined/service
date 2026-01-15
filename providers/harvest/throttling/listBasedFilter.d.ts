// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { EntityCoordinates } from '../../../lib/entityCoordinates'
import { Logger } from '../../logging'

/** Configuration options for ListBasedFilter */
export interface ListBasedFilterOptions {
  /** Array of coordinate strings to blacklist */
  blacklist?: string[]
  /** Logger instance for logging operations */
  logger?: Logger
}

/** A filter that blocks entities based on a blacklist of coordinate strings */
declare class ListBasedFilter {
  /** Configuration options for the filter */
  options: ListBasedFilterOptions

  /** Logger instance for filter operations */
  logger: Logger

  /** Set of target types that are covered by the blacklist */
  private _targetTypes: Set<string>

  /** Set of versionless coordinate strings that are blacklisted */
  private _blacklist: Set<string>

  /**
   * Creates a new ListBasedFilter instance
   *
   * @param options - Configuration options including blacklist and logger
   */
  constructor(options?: ListBasedFilterOptions)

  /**
   * Quick predicate to check if a coordinate is blacklisted.
   * Accepts coordinate, matches by versionless form.
   *
   * @param coord - The entity coordinates to check
   * @returns true if the coordinate is blocked, false otherwise
   */
  isBlocked(coord: EntityCoordinates): boolean

  /**
   * Convert coordinate string to versionless form
   * Transforms "type/provider/namespace/name[/revision]" -> "type/provider/namespace/name"
   *
   * @param coordString - The coordinate string to convert
   * @returns The versionless EntityCoordinates or null if invalid
   */
  private _toVersionless(coordString: string): EntityCoordinates | null
}

export = ListBasedFilter
