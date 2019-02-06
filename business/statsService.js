// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../providers/logging/logger')

class StatsService {
  constructor(definitionService, searchService) {
    this.definitionService = definitionService
    this.searchService = searchService
    this.logger = logger()
    this.statLookup = this._getStatLookup()
  }

  get(stat) {
    stat = stat.toLowerCase()
    if (!this.statLookup[stat]) throw new Error('Not found')
    try {
      return this.statLookup[stat].bind(this)()
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
}

module.exports = (definitionService, searchService) => new StatsService(definitionService, searchService)
