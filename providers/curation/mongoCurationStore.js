// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const throat = require('throat')
const Curation = require('../../lib/curation')
const logger = require('../logging/logger')()

class MongoCurationStore {
  constructor(options) {
    this.logger = logger()
    this.options = options
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(
          this.options.connectionString,
          { useNewUrlParser: true }
        )
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection('curations')
      } catch (error) {
        logger.info('retrying mongo connection')
        retry(error)
      }
    })
  }

  /**
   * Store the given set of curations overwriting any previous content. This effectively replicates the
   * content of the files in the GitHub curation repo.
   * @param {[Curation]} curations
   */
  async updateCurations(curations) {
    await Promise.all(
      curations.map(
        throat(10, async curation => {
          const _id = this._getCurationId(curation.data.coordinates)
          if (_id) await this.collection.replaceOne({ _id }, { _id, ...curation.data }, { upsert: true })
        })
      )
    )
    return null
  }

  /**
   * Retrieve the contribution by number
   * @param {Number} prNumber - the PR number as provided by GitHub
   * @returns the Curations found if any
   */
  getContribution(prNumber) {
    return this.collection.findOne({ _id: prNumber })
  }

  /**
   * Update the contribution entry for the given PR and record the associated curations -- the
   * actual file content in the PR. If the curations are not provided, just the PR data is updated,
   * any existing curation data is preserved.
   * @param {*} pr - the PR object as provided by GitHub
   * @param {[Curation]} curations? - The set of actual proposed changes.
   */
  updateContribution(pr, curations = null) {
    if (curations) {
      const files = {}
      curations.forEach(curation => (files[curation.path] = curation.data))
      return this.collection.replaceOne({ _id: pr.number }, { _id: pr.number, pr, files }, { upsert: true })
    }
    // TODO reconsider `upsert` here. Great for resiliency but will it result in undetected inconsistent data?
    return this.collection.updateOne({ _id: pr.number }, { $set: { pr: pr } }, { upsert: true })
  }

  /**
   * List all of the Curations whose coordinates match the given partial coordinates.
   * @param {EntityCoordinates} coordinates - partial coordinates to look for
   * @returns the array of Curations found
   */
  // TODO need to do something about paging
  list(coordinates) {
    if (!coordinates) throw new Error('must specify coordinates to list')
    const pattern = this._getCurationId(coordinates.asRevisionless())
    if (!pattern) return []
    return this.collection
      .find({ _id: new RegExp('^' + pattern) })
      .toArray()
      .then(list => Curation.getAllCoordinates(list.map(entry => new Curation(entry, null, false))))
  }

  _getCurationId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()
  }
}

module.exports = options => new MongoCurationStore(options)
