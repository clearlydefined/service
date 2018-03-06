// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const DefinitionsCache = require('./definitionsCache')
const utils = require('../lib/utils')
const _ = require('lodash')

class CacheRefresher {
  constructor(harvest, curation) {
    this.harvestService = harvest
    this.curationService = curation
    setInterval(this.refreshDefinitions.bind(this), 4 * 60 * 1000)
  }

  async refreshDefinitions() {
    const coordinates = utils.toEntityCoordinatesFromRequest({ params: {} })
    const curated = await this.curationService.list(coordinates)
    const harvest = await this.harvestService.list(coordinates)
    const stringHarvest = harvest.map(c => c.toString())
    const result = _.union(stringHarvest, curated)
    DefinitionsCache.set(coordinates, result, 5 * 60 * 1000)
  }
}

module.exports = (harvest, curation) => new CacheRefresher(harvest, curation)
