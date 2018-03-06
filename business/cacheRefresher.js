// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const appInsights = require('applicationinsights')
const DefinitionsCache = require('./definitionsCache')
const utils = require('../lib/utils')
const _ = require('lodash')

class CacheRefresher {
  constructor(harvest, curation) {
    this.harvestService = harvest
    this.curationService = curation
    setInterval(this.refresh.bind(this), 5 * 60 * 1000)
  }

  async refresh() {
    try {
      await this.refreshDefinitions()
    } catch (error) {
      appInsights.defaultClient.trackException({
        exception: error,
        properties: { eventName: 'CacheRefreshError' }
      })
    }
  }

  async refreshDefinitions() {
    const coordinates = utils.toEntityCoordinatesFromRequest({ params: {} })
    const curated = await this.curationService.list(coordinates)
    const harvest = await this.harvestService.list(coordinates)
    const stringHarvest = harvest.map(c => c.toString())
    const result = _.union(stringHarvest, curated)
    DefinitionsCache.set(coordinates, result, 10 * 60 * 1000)
  }
}

module.exports = (harvest, curation) => new CacheRefresher(harvest, curation)
