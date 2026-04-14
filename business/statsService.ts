// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from '../providers/caching/index.js'
import type { Logger } from '../providers/logging/index.js'
import type { DefinitionService } from './definitionService.ts'

import logger from '../providers/logging/logger.ts'

/** Facet entry in a frequency table */
export interface FacetEntry {
  count: number
  value: string | number
}

/** Statistics result for a component type */
export interface TypeStats {
  totalCount: number
  describedScoreMedian: number
  licensedScoreMedian: number
  declaredLicenseBreakdown: FacetEntry[]
}

/** Available stat keys */
export type StatKey =
  | 'total'
  | 'conda'
  | 'condasrc'
  | 'crate'
  | 'gem'
  | 'git'
  | 'maven'
  | 'npm'
  | 'nuget'
  | 'pod'
  | 'composer'
  | 'pypi'
  | 'deb'
  | 'debsrc'

/** Search service interface for stats queries */
export interface StatsSearchService {
  query(query: StatsQuery): Promise<StatsSearchResponse>
}

/** Query parameters for stats */
export interface StatsQuery {
  count: boolean
  filter: string | null
  facets: string[]
  top: number
}

/** Search response with facets */
export interface StatsSearchResponse {
  '@odata.count': number
  '@search.facets': {
    describedScore: FacetEntry[]
    licensedScore: FacetEntry[]
    declaredLicense: FacetEntry[]
  }
}

/**
 * Service for computing and caching statistics about definitions.
 * Provides aggregate metrics broken down by component type.
 */
class StatsService {
  definitionService: DefinitionService
  searchService: StatsSearchService
  logger: Logger
  cache: ICache
  statLookup: Record<StatKey, () => Promise<TypeStats>>

  constructor(definitionService: DefinitionService, searchService: StatsSearchService, cache: ICache) {
    this.definitionService = definitionService
    this.searchService = searchService
    this.logger = logger()
    this.cache = cache
    this.statLookup = this._getStatLookup()
  }

  async get(stat: string): Promise<TypeStats> {
    const statKey = stat.toLowerCase() as StatKey
    if (!this.statLookup[statKey]) {
      throw new Error('Not found')
    }
    try {
      const cacheKey = this._getCacheKey(statKey)
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        return cached
      }
      const result = await this.statLookup[statKey].bind(this)()
      if (result) {
        await this.cache.set(cacheKey, result, 60 * 60 /* 1h */)
      }
      return result
    } catch (error) {
      this.logger.error(`Stat service failed for ${statKey}`, error)
      throw new Error('unexpected error', { cause: error })
    }
  }

  list(): StatKey[] {
    return Object.keys(this.statLookup) as StatKey[]
  }

  _getStatLookup(): Record<StatKey, () => Promise<TypeStats>> {
    return {
      total: () => this._getType('total'),
      conda: () => this._getType('conda'),
      condasrc: () => this._getType('condasrc'),
      crate: () => this._getType('crate'),
      gem: () => this._getType('gem'),
      git: () => this._getType('git'),
      maven: () => this._getType('maven'),
      npm: () => this._getType('npm'),
      nuget: () => this._getType('nuget'),
      pod: () => this._getType('pod'),
      composer: () => this._getType('composer'),
      pypi: () => this._getType('pypi'),
      deb: () => this._getType('deb'),
      debsrc: () => this._getType('debsrc')
    }
  }

  async _getType(type: string): Promise<TypeStats> {
    const response = await this.searchService.query({
      count: true,
      filter: type === 'total' ? null : `type eq '${type}'`,
      facets: ['describedScore,interval:1', 'licensedScore,interval:1', 'declaredLicense'],
      top: 0
    })
    const totalCount = response['@odata.count']
    const describedScoreMedian = this._getMedian(response['@search.facets'].describedScore, totalCount)
    const licensedScoreMedian = this._getMedian(response['@search.facets'].licensedScore, totalCount)
    const declaredLicenseBreakdown = this._getFacet(response['@search.facets'].declaredLicense, totalCount)
    return { totalCount, describedScoreMedian, licensedScoreMedian, declaredLicenseBreakdown }
  }

  _getMedian(frequencyTable: FacetEntry[], totalCount: number): number {
    if (totalCount === 0) {
      return 0
    }
    const cutoff = Math.ceil(totalCount / 2)
    let marker = 0
    let median = 0
    for (let i = 0; marker < cutoff && i < frequencyTable.length; i++) {
      marker += frequencyTable[i].count
      median = frequencyTable[i].value as number
    }
    return median
  }

  _getFacet(frequencyTable: FacetEntry[], totalCount: number): FacetEntry[] {
    const otherSum = frequencyTable.reduce((result, current) => {
      result -= current.count
      return result
    }, totalCount)
    frequencyTable.push({
      count: otherSum,
      value: 'Other'
    })
    return frequencyTable
  }

  _getCacheKey(stat: string): string {
    return `stat_${stat.toLowerCase()}`
  }
}

export default (definitionService: DefinitionService, searchService: StatsSearchService, cache: ICache): StatsService =>
  new StatsService(definitionService, searchService, cache)
