// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'

const { values, get } = lodash

import EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { SearchOptions } from './abstractSearch.ts'
import AbstractSearch from './abstractSearch.ts'

export interface SearchEntry {
  coordinates: string
  releaseDate?: string
  declaredLicense?: string
  discoveredLicenses: string[]
  attributionParties: string[]
}

class MemorySearch extends AbstractSearch {
  index: Record<string, SearchEntry>

  constructor(options: SearchOptions) {
    super(options)
    this.index = {}
  }

  /**
   * Get a list of suggested coordinates that match the given pattern
   * @override
   */
  override async suggestCoordinates(pattern: string): Promise<string[]> {
    const patternElements = pattern?.split('/').map(e => e.toLowerCase())
    return values(this.index)
      .filter(definition => this._isMatch(patternElements, definition.coordinates.toLowerCase()))
      .map(entry => entry.coordinates)
  }

  _isMatch(requiredParts: string[] = [], coordinates: string) {
    return requiredParts.every(part => coordinates.includes(part))
  }

  /** @override */
  override store(definitions: any) {
    const entries = this._getEntries(Array.isArray(definitions) ? definitions : [definitions])
    for (const entry of entries) {
      this.index[entry.coordinates] = entry
    }
  }

  /** @override */
  override async query(body: { count?: boolean }): Promise<{ count: number }> {
    if (!body.count) {
      throw new Error('unsupported query')
    }
    return { count: Object.keys(this.index).length }
  }

  _getEntries(definitions: any[]) {
    return definitions.map((definition: any) => {
      return {
        coordinates: EntityCoordinates.fromObject(definition.coordinates).toString(),
        releaseDate: get(definition, 'described.releaseDate'),
        declaredLicense: get(definition, 'licensed.declared'),
        discoveredLicenses: this._getLicenses(definition),
        attributionParties: this._getAttributions(definition)
      }
    })
  }

  /** @override */
  override delete(coordinates: { toString(): string }) {
    delete this.index[coordinates.toString()]
  }
}

export default (options: SearchOptions) => new MemorySearch(options)
