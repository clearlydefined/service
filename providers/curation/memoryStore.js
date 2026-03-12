// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('../../lib/curation')} Curation */
/** @typedef {import('../../lib/curation').CurationData} CurationData */
/** @typedef {import('.').ContributionPR} ContributionPR */
/** @typedef {import('.').Contribution} Contribution */

const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')

class MemoryStore {
  /** @param {Record<string, unknown>} [options] */
  constructor(options) {
    this.logger = logger()
    this.options = options
    /** @type {Record<string, CurationData>} */
    this.curations = {}
    /** @type {Record<number, Contribution>} */
    this.contributions = {}
  }

  initialize() {}

  /** @param {Curation[]} curations */
  updateCurations(curations) {
    curations.forEach(curation => {
      const coordinates = EntityCoordinates.fromObject(curation.data.coordinates)
      this.curations[this._getCurationId(coordinates)] = curation.data
    })
  }

  /** @param {number} prNumber */
  getContribution(prNumber) {
    return this.contributions[prNumber]
  }

  /**
   * @param {ContributionPR} pr
   * @param {Curation[] | null} [curations]
   */
  updateContribution(pr, curations = null) {
    if (curations) {
      /** @type {Record<string, CurationData>} */
      const files = {}
      curations.forEach(curation => (files[curation.path] = curation.data))
      this.contributions[pr.number] = { pr, files }
      return
    }
    const current = this.contributions[pr.number]
    const files = current ? current.files : /** @type {Record<string, CurationData>} */ ({})
    this.contributions[pr.number] = { pr, files }
  }

  /** @param {EntityCoordinates} coordinates */
  list(coordinates) {
    if (!coordinates) throw new Error('must specify coordinates to list')
    const pattern = this._getCurationId(coordinates)
    return Object.keys(this.curations)
      .filter(key => key.startsWith(pattern))
      .map(key => this.curations[key])
  }

  /** @param {EntityCoordinates[]} coordinatesList */
  listAll(coordinatesList) {
    /** @type {Record<string, CurationData[]>} */
    const result = {}
    coordinatesList.forEach(coordinates => {
      const data = this.list(coordinates)
      if (!data) return
      const key = coordinates.toString()
      result[key] = data
    })
    return result
  }

  /** @param {EntityCoordinates} coordinates */
  _getCurationId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates).toString().toLowerCase()
  }
}

module.exports = /** @param {Record<string, unknown>} [options] */ options => new MemoryStore(options)
