// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const EntityCoordinates = require('../../../lib/entityCoordinates')
const loggerFactory = require('../../logging/logger')

class ListBasedFilter {
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

  // Convert "type/provider/namespace/name[/revision]" -> "type/provider/namespace/name"
  _toVersionless(coordString) {
    try {
      const coordinates = EntityCoordinates.fromString(coordString)
      if (coordinates.type === undefined || coordinates.provider === undefined || coordinates.name === undefined) {
        throw new Error('Incomplete coordinates')
      }
      return coordinates.asRevisionless()
    } catch (e) {
      this.logger.error(`Invalid coordinates in blacklist: ${coordString}, ${e.message}`)
      return null
    }
  }
}

module.exports = ListBasedFilter
