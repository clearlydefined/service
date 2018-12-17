// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')

class MemoryStore {
  constructor(options) {
    this.logger = logger()
    this.options = options
    this.curations = {}
    this.contributions = {}
  }

  initialize() {}

  updateCurations(curations) {
    curations.forEach(curation => {
      const coordinates = EntityCoordinates.fromObject(curation.data.coordinates)
      this.curations[this._getCurationId(coordinates)] = curation.data
    })
  }

  getContribution(prNumber) {
    return this.contributions[prNumber]
  }

  updateContribution(pr, curations = null) {
    if (curations) {
      const files = {}
      curations.forEach(curation => (files[curation.path] = curation.data))
      return (this.contributions[pr.number] = { pr, files })
    }
    const current = this.contributions[pr.number]
    const files = current ? current.files : {}
    this.contributions[pr.number] = { pr, files }
  }

  list(coordinates) {
    if (!coordinates) throw new Error('must specify coordinates to list')
    const pattern = this._getCurationId(coordinates)
    return Object.keys(this.curations)
      .filter(key => key.startsWith(pattern))
      .map(key => this.curations[key])
  }

  _getCurationId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()
  }
}

module.exports = options => new MemoryStore(options)
