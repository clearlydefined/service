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
    this.blacklist = new Set(raw.map(c => this._toVersionless(c)).filter(Boolean))
  }

  /**
   * Quick predicate to check if a coordinate is blacklisted.
   * Accepts coordinate, matches by versionless form.
   * @param {EntityCoordinates} coord
   * @returns {boolean} true if blocked
   */
  isBlocked(coord) {
    if (!coord || this.blacklist.size === 0) return false
    const versionless = coord.asRevisionless().toString()
    return this.blacklist.has(versionless)
  }

  // Convert "type/provider/namespace/name[/revision]" -> "type/provider/namespace/name"
  _toVersionless(coordString) {
    try {
      const coordinates = EntityCoordinates.fromString(coordString)
      if (coordinates.type === undefined || coordinates.provider === undefined || coordinates.name === undefined) {
        this.logger.error(`Incomplete coordinates in blacklist: ${coordString}`)
        return null
      }
      return coordinates.asRevisionless().toString()
    } catch (e) {
      this.logger.error(`Invalid coordinates in blacklist: ${coordString}`)
      return null
    }
  }
}

module.exports = ListBasedFilter
