// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../providers/logging/logger')

class StatsService {
  constructor(definitionService, searchService, cache) {
    this.definitionService = definitionService
    this.searchService = searchService
    this.logger = logger()
    this.cache = cache
    this.statLookup = this._getStatLookup()
  }

  async get(stat) {
    stat = stat.toLowerCase()
    if (!this.statLookup[stat]) throw new Error('Not found')
    try {
      const cacheKey = this._getCacheKey(stat)
      const cached = await this.cache.get(cacheKey)
      if (cached) return cached
      const result = await this.statLookup[stat].bind(this)()
      if (result) await this.cache.set(cacheKey, result)
      return result
    } catch (error) {
      this.logger.error(`Stat service failed for ${stat}`, error)
      throw new Error('unexpected error')
    }
  }

  list() {
    return Object.keys(this.statLookup)
  }

  _getStatLookup() {
    return {
      totalcount: this._getTotalCount,
      crate: () => this._getType('crate'),
      gem: () => this._getType('gem'),
      git: () => this._getType('git'),
      maven: () => this._getType('maven'),
      npm: () => this._getType('npm'),
      nuget: () => this._getType('nuget'),
      pod: () => this._getType('pod'),
      pypi: () => this._getType('pypi')
    }
  }

  async _getTotalCount() {
    const result = await this.searchService.query({ count: true, top: 0 })
    return result['@odata.count']
  }

  async _getType(type) {
    const result = await this.definitionService.average({ type }, ['licensed.score.total', 'described.score.total'])
    return result
  }

  _getCacheKey(stat) {
    return `stat_${stat.toLowerCase()}`
  }
}

module.exports = (definitionService, searchService, cache) => new StatsService(definitionService, searchService, cache)
