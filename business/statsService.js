// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./definitionService').DefinitionService} DefinitionService
 * @typedef {import('./statsService').StatsSearchService} StatsSearchService
 * @typedef {import('./statsService').TypeStats} TypeStats
 * @typedef {import('./statsService').FacetEntry} FacetEntry
 * @typedef {import('./statsService').StatKey} StatKey
 * @typedef {import('./statsService').StatsSearchResponse} StatsSearchResponse
 * @typedef {import('../providers/caching').ICache} ICache
 * @typedef {import('../providers/logging').Logger} Logger
 */

const logger = require('../providers/logging/logger')

/**
 * Service for computing and caching statistics about definitions.
 * Provides aggregate metrics broken down by component type.
 */
class StatsService {
  /**
   * Creates a new StatsService instance
   *
   * @param {DefinitionService} definitionService - The definition service
   * @param {StatsSearchService} searchService - The search service for querying
   * @param {ICache} cache - Cache for storing results
   */
  constructor(definitionService, searchService, cache) {
    this.definitionService = definitionService
    this.searchService = searchService
    /** @type {Logger} */
    this.logger = logger()
    this.cache = cache
    this.statLookup = this._getStatLookup()
  }

  /**
   * Get statistics for a specific key
   *
   * @param {string} stat - The stat key to retrieve
   * @returns {Promise<TypeStats>} The statistics data
   * @throws {Error} if key is not found or if an unexpected error occurs
   */
  async get(stat) {
    const statKey = /** @type {StatKey} */ (stat.toLowerCase())
    if (!this.statLookup[statKey]) throw new Error('Not found')
    try {
      const cacheKey = this._getCacheKey(statKey)
      const cached = await this.cache.get(cacheKey)
      if (cached) return cached
      const result = await this.statLookup[statKey].bind(this)()
      if (result) await this.cache.set(cacheKey, result, 60 * 60 /* 1h */)
      return result
    } catch (error) {
      this.logger.error(`Stat service failed for ${statKey}`, error)
      throw new Error('unexpected error', { cause: error })
    }
  }

  /**
   * List all available stat keys
   *
   * @returns {StatKey[]} Array of available stat keys
   */
  list() {
    return /** @type {StatKey[]} */ (Object.keys(this.statLookup))
  }

  /**
   * Get the lookup table for stat functions
   *
   * @returns {Record<StatKey, () => Promise<TypeStats>>} The stat lookup table
   * @private
   */
  _getStatLookup() {
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

  /**
   * Get statistics for a component type
   *
   * @param {string} type - The component type (e.g., 'npm', 'maven', 'total')
   * @returns {Promise<TypeStats>} The statistics for the type
   * @private
   */
  async _getType(type) {
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

  /**
   * Calculate the median from a frequency table
   *
   * @param {FacetEntry[]} frequencyTable - Array of facet entries
   * @param {number} totalCount - Total count of items
   * @returns {number} The median value
   * @private
   */
  _getMedian(frequencyTable, totalCount) {
    if (totalCount === 0) return 0
    const cutoff = Math.ceil(totalCount / 2)
    let marker = 0
    let median = 0
    for (let i = 0; marker < cutoff && i < frequencyTable.length; i++) {
      marker += frequencyTable[i].count
      median = /** @type {number} */ (frequencyTable[i].value)
    }
    return median
  }

  /**
   * Get a facet breakdown with an 'Other' category
   *
   * @param {FacetEntry[]} frequencyTable - Array of facet entries
   * @param {number} totalCount - Total count of items
   * @returns {FacetEntry[]} The facet entries with 'Other' appended
   * @private
   */
  _getFacet(frequencyTable, totalCount) {
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

  /**
   * Get cache key for a stat
   *
   * @param {string} stat - The stat key
   * @returns {string} The cache key
   * @private
   */
  _getCacheKey(stat) {
    return `stat_${stat.toLowerCase()}`
  }
}

/**
 * Factory function to create a StatsService instance
 *
 * @param {DefinitionService} definitionService - The definition service
 * @param {StatsSearchService} searchService - The search service for querying
 * @param {ICache} cache - Cache for storing results
 * @returns {StatsService} A new StatsService instance
 */
module.exports = (definitionService, searchService, cache) => new StatsService(definitionService, searchService, cache)
