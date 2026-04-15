// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import EntityCoordinates from '../../../lib/entityCoordinates.ts'
import validator from '../../../schemas/validator.ts'
import type { Logger } from '../../logging/index.js'
import loggerFactory from '../../logging/logger.ts'

export interface ListBasedFilterOptions {
  blacklist?: string[]
  logger?: Logger
}

class ListBasedFilter {
  declare options: ListBasedFilterOptions
  declare logger: Logger
  private declare _targetTypes: Set<string>
  private declare _blacklist: Set<string>

  constructor(options: ListBasedFilterOptions = {}) {
    this.options = options
    this.logger = options.logger || loggerFactory()
    const raw = options.blacklist || []
    // Normalize blacklist entries to versionless coordinates for broad matching
    const versionlessCoordinates = raw.map(c => this._toVersionless(c)).filter((c): c is EntityCoordinates => c !== null)
    // Store as a Set for quick type lookup
    this._targetTypes = new Set(versionlessCoordinates.map(c => c.type!))
    this._blacklist = new Set(versionlessCoordinates.map(c => c.toString()))
    this.logger.info('ListBasedFilter initialized', {
      blockedCount: this._blacklist.size,
      blockedCoordinates: [...this._blacklist].sort(),
      targetTypes: [...this._targetTypes].sort()
    })
  }

  isBlocked(coord: EntityCoordinates): boolean {
    if (!coord || this._blacklist.size === 0) {
      return false
    }
    if (!this._targetTypes.has(coord.type!)) {
      return false
    }
    const versionless = coord.asRevisionless().toString()
    return this._blacklist.has(versionless)
  }

  _toVersionless(coordString: string): EntityCoordinates | null {
    try {
      const coordinates = EntityCoordinates.fromString(coordString)
      if (!validator.validate('versionless-coordinates-1.0', coordinates)) {
        const errorMessage = validator.errors!.map(e => `${e.instancePath} ${e.message}`).join(', ')
        throw new Error(errorMessage)
      }
      return coordinates!.asRevisionless()
    } catch (e) {
      this.logger.warn(
        `Invalid coordinates in blacklist, ignoring: ${coordString}, ${e instanceof Error ? e.message : String(e)}`
      )
      return null
    }
  }
}

export default ListBasedFilter
