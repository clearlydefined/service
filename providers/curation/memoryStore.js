// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const EntityCoordinates = require('../../lib/entityCoordinates')

class MemoryStore {
  constructor(options) {
    this.options = options
    this.curations = {}
    this.contributions = {}
  }

  updateCurations(curations) {
    curations.forEach(curation => {
      const coordinates = EntityCoordinates.fromObject(curation.data.coordinates)
      this.curations[coordinates.toString()] = curation
    })
  }

  updateContribution(pr, curations = null) {
    if (curations) {
      const files = {}
      if (curations) curations.forEach(curation => (files[curation.path] = curation.data))
      return (this.contributions[pr.number] = { pr, files })
    }
    const current = this.contributions[pr.number]
    const files = current ? current.files : {}
    this.contributions[pr.number] = { pr, files }
  }

  list(coordinates) {
    const pattern = coordinates.asRevisionless().toString()
    return Object.keys(this.curations)
      .filter(key => key.startsWith(pattern))
      .map(key => this.curations[key])
  }
}

module.exports = options => new MemoryStore(options)
