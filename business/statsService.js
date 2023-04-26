// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../providers/logging/logger')

class StatsService {
  constructor(statsProvider, cache) {
    this.statsProvider = statsProvider
    this.logger = logger()
    this.cache = cache
    this.statLookup = this._getStatLookup()
  }

  async get(stat, { withLicenses = true } = {} ) {
    stat = stat.toLowerCase()
    if (!this.statLookup[stat]) throw new Error('Not found')
    try {
      const { cacheKey, cached } = await this._lookupInCache(stat, withLicenses)
      if (cached) return cached
      const result = await this.statLookup[stat].bind(this)(withLicenses)
      if (result) await this.cache.set(cacheKey, result, 60 * 60 /* 1h */)
      return result
    } catch (error) {
      this.logger.error(`Stat service failed for ${stat}, withLicenses: ${withLicenses}`, error)
      throw new Error('unexpected error')
    }
  }

  list() {
    return Object.keys(this.statLookup)
  }

  _getStatLookup() {
    return {
      total: (withLicenses) => this._getType('total', withLicenses),
      crate: (withLicenses) => this._getType('crate', withLicenses),
      gem: (withLicenses) => this._getType('gem', withLicenses),
      git: (withLicenses) => this._getType('git', withLicenses),
      maven: (withLicenses) => this._getType('maven', withLicenses),
      npm: (withLicenses) => this._getType('npm', withLicenses),
      nuget: (withLicenses) => this._getType('nuget', withLicenses),
      pod: (withLicenses) => this._getType('pod', withLicenses),
      composer: (withLicenses) => this._getType('composer', withLicenses),
      pypi: (withLicenses) => this._getType('pypi', withLicenses),
      deb: (withLicenses) => this._getType('deb', withLicenses),
      debsrc: (withLicenses) => this._getType('debsrc', withLicenses),
    }
  }

  async _getType(type, withLicenses) {
    const stats = await this.statsProvider.fetchStats(type, withLicenses)
    const { totalCount, describedScores = [], licensedScores = [], declaredLicenses = [] } = stats
    const describedScoreMedian = this._getMedian(describedScores, totalCount)
    const licensedScoreMedian = this._getMedian(licensedScores, totalCount)
    const declaredLicenseBreakdown = withLicenses ? this._getFacet(declaredLicenses, totalCount) : []
    return { totalCount, describedScoreMedian, licensedScoreMedian, declaredLicenseBreakdown }
  }

  _getMedian(frequencyTable, totalCount) {
    if (totalCount === 0) return 0
    const cutoff = Math.ceil(totalCount / 2)
    let marker = 0
    let median = 0
    for (let i = 0; marker < cutoff && i < frequencyTable.length; i++) {
      marker += frequencyTable[i].count
      median = frequencyTable[i].value
    }
    return median
  }

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

  _getCacheKey(stat, withLicenses) {
    const licenses = withLicenses ? '' : '_no_licenses'
    return `stat_${stat.toLowerCase()}${licenses}`
  }

  async _lookupInCache(stat, withLicenses) {
    const cacheKey = this._getCacheKey(stat, withLicenses)
    let cached = await this.cache.get(cacheKey)
    if (!cached && !withLicenses) {
      const cachedWithLicenses = await this.cache.get(this._getCacheKey(stat, true))
      cached = cachedWithLicenses && { ...cachedWithLicenses, declaredLicenseBreakdown: [] }
    }
    return { cacheKey, cached }
  }
}

module.exports = (searchService, cache) => new StatsService(searchService, cache)
