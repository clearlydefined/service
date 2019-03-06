// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const throat = require('throat')
const { get } = require('lodash')
const logger = require('../logging/logger')

class MongoCurationStore {
  constructor(options) {
    this.logger = logger()
    this.options = options
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(this.options.connectionString, { useNewUrlParser: true })
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection(this.options.collectionName)
      } catch (error) {
        this.logger.info('retrying mongo connection')
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
    if (!curations || !curations.some(curation => get(curation, 'data.coordinates') && get(curation, 'data.revisions')))
      return this.collection.updateOne({ _id: pr.number }, { $set: { pr: pr } }, { upsert: true })
    const files = curations
      .map(curation => {
        return {
          path: curation.path,
          coordinates: this._lowercaseCoordinates(curation.data.coordinates),
          revisions: Object.keys(curation.data.revisions).map(revision => {
            return {
              revision,
              data: curation.data.revisions[revision]
            }
          })
        }
      })
      .filter(x => x)
    return this.collection.replaceOne({ _id: pr.number }, { _id: pr.number, pr, files }, { upsert: true })
  }

  /**
   * List all of the Curations and Contributions whose coordinates match the given partial coordinates.
   * @param {EntityCoordinates} coordinates - partial coordinates to look for
   * @returns the Curations and Contributions found
   */
  // TODO need to do something about paging
  async list(coordinates) {
    if (!coordinates) throw new Error('must specify coordinates to list')
    const pattern = this._getCurationId(coordinates.asRevisionless())
    if (!pattern) return null
    const curations = await this.collection
      .find({ _id: new RegExp('^' + pattern) })
      .project({ _id: 0 })
      .toArray()
      .then(this._formatCurations)
    const contributions = await this.collection
      .find(this._buildContributionQuery(coordinates))
      .sort({ 'pr.number': -1 })
      .project({ _id: 0 })
      .toArray()
    return { curations, contributions }
  }

  _getCurationId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()
  }

  _buildContributionQuery(coordinates) {
    const result = {}
    if (coordinates.type) result['files.coordinates.type'] = coordinates.type.toLowerCase()
    if (coordinates.provider) result['files.coordinates.provider'] = coordinates.provider.toLowerCase()
    if (coordinates.namespace) result['files.coordinates.namespace'] = coordinates.namespace.toLowerCase()
    if (coordinates.name) result['files.coordinates.name'] = coordinates.name.toLowerCase()
    if (coordinates.revision) result['files.revisions.revision'] = coordinates.revision.toLowerCase()
    return result
  }

  _formatCurations(curations) {
    return curations.reduce((result, entry) => {
      Object.keys(entry.revisions).forEach(revision => {
        let coordinates = EntityCoordinates.fromObject({ ...entry.coordinates, revision }).toString()
        result[coordinates] = entry.revisions[revision]
      })
      return result
    }, {})
  }

  _lowercaseCoordinates(input) {
    return EntityCoordinates.fromString(
      EntityCoordinates.fromObject(input)
        .toString()
        .toLowerCase()
    )
  }
}

module.exports = options => new MongoCurationStore(options)
