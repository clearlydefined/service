// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const EntityCoordinates = require('../../../lib/entityCoordinates')
const validator = require('../../../schemas/validator')
const loggerFactory = require('../../logging/logger')

/**
 * @typedef {import('./listBasedFilter.d.ts').ListBasedFilterOptions} ListBasedFilterOptions
 *
 * @typedef {import('../../logging').Logger} Logger
 */

class ListBasedFilter {
  /**
   * Creates a new ListBasedFilter instance
   * @param {ListBasedFilterOptions} [options={}] - Configuration options including blacklist and logger
   */
  constructor(options = {}) {
    this.options = options
    this.logger = options.logger || loggerFactory()
    const raw = options.blacklist || []
    // Normalize blacklist entries to versionless coordinates for broad matching
    const versionlessCoordinates = raw.map(c => this._toVersionless(c)).filter(Boolean)
    // Store as a Set for quick type lookup
    this._targetTypes = new Set(versionlessCoordinates.map(c => c.type))
    this._blacklist = new Set(versionlessCoordinates.map(c => c.toString()))
  }

  /**
   * Quick predicate to check if a coordinate is blacklisted.
   * Accepts coordinate, matches by versionless form.
   * @param {EntityCoordinates} coord
   * @returns {boolean} true if blocked
   */
  isBlocked(coord) {
    if (!coord || this._blacklist.size === 0) return false
    if (!this._targetTypes.has(coord.type)) return false
    const versionless = coord.asRevisionless().toString()
    return this._blacklist.has(versionless)
  }

  /**
   * Convert coordinate string to versionless form
   * Transforms "type/provider/namespace/name[/revision]" -> "type/provider/namespace/name"
   * @param {string} coordString - The coordinate string to convert
   * @returns {EntityCoordinates|null} The versionless EntityCoordinates or null if invalid
   */
  _toVersionless(coordString) {
    try {
      const coordinates = EntityCoordinates.fromString(coordString)
      if (!validator.validate('versionless-coordinates-1.0', coordinates)) {
        const errorMessage = validator.errors.map(e => `${e.instancePath} ${e.message}`).join(', ')
        throw new Error(errorMessage)
      }
      return coordinates.asRevisionless()
    } catch (e) {
      this.logger.warn(
        `Invalid coordinates in blacklist, ignoring: ${coordString}, ${e instanceof Error ? e.message : String(e)}`
      )
      return null
    }
  }
}

module.exports = ListBasedFilter
