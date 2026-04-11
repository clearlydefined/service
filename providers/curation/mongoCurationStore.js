// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('../../lib/entityCoordinates').EntityCoordinatesSpec} EntityCoordinatesSpec */
/** @typedef {import('../../lib/curation')} Curation */
/** @typedef {import('../../lib/curation').CurationData} CurationData */
/** @typedef {import('../../lib/curation').CurationRevision} CurationRevision */
/** @typedef {import('./mongoCurationStore').MongoCurationStoreOptions} MongoCurationStoreOptions */
/** @typedef {import('.').ContributionPR} ContributionPR */
/** @typedef {import('mongodb').MongoClient} MongoClientType */
/** @typedef {import('mongodb').Db} Db */
/** @typedef {import('mongodb').Collection<{ _id: string | number, [key: string]: unknown }>} CurationCollection */

import lodash from 'lodash'
import { MongoClient } from 'mongodb'
import promiseRetry from 'promise-retry'
import throat from 'throat'
import EntityCoordinates from '../../lib/entityCoordinates.ts'

const { get } = lodash

import logger from '../logging/logger.ts'

class MongoCurationStore {
  /** @param {MongoCurationStoreOptions} options */
  constructor(options) {
    this.logger = logger()
    this.options = options
    /** @type {MongoClientType} */
    this.client = /** @type {*} */ (undefined)
    /** @type {Db} */
    this.db = /** @type {*} */ (undefined)
    /** @type {CurationCollection} */
    this.collection = /** @type {*} */ (undefined)
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(this.options.connectionString)
        this.logger.info('MongoDB connection initialized', {
          database: this.options.dbName,
          collection: this.options.collectionName
        })
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection(this.options.collectionName)
      } catch (/** @type {*} */ error) {
        this.logger.info(`retrying mongo connection: ${error.message}`)
        retry(error)
      }
    })
  }

  /**
   * Store the given set of curations overwriting any previous content. This effectively replicates the
   * content of the files in the GitHub curation repo.
   * @param {Curation[]} curations
   * @returns {Promise<null>}
   */
  async updateCurations(curations) {
    await Promise.all(
      curations.map(
        throat(10, async curation => {
          const _id = this._getCurationId(curation.data.coordinates)
          if (_id) {
            await this.collection.replaceOne({ _id }, { _id, ...curation.data }, { upsert: true })
          }
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
   * @param {ContributionPR} pr - the PR object as provided by GitHub
   * @param {Curation[] | null} [curations] - The set of actual proposed changes.
   */
  updateContribution(pr, curations = null) {
    if (!curations?.some(curation => get(curation, 'data.coordinates') && get(curation, 'data.revisions'))) {
      return this.collection.updateOne({ _id: pr.number }, { $set: { pr: pr } }, { upsert: true })
    }
    const files = curations
      .filter(curation => get(curation, 'data.coordinates') && get(curation, 'data.revisions'))
      .map(curation => {
        return {
          path: curation.path,
          coordinates: this._lowercaseCoordinates(curation.data.coordinates),
          revisions: Object.keys(curation.data.revisions).map(revision => {
            return {
              revision: revision.toLowerCase(),
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
    if (!coordinates) {
      throw new Error('must specify coordinates to list')
    }
    const pattern = this._getCurationId(coordinates.asRevisionless())
    if (!pattern) {
      return null
    }
    const safePattern = this._escapeRegex(pattern)
    // Limit the length of the pattern to prevent ReDoS and ensure it's a string
    const maxPatternLength = 256
    const limitedPattern = typeof safePattern === 'string' ? safePattern.substring(0, maxPatternLength) : ''
    if (!limitedPattern) {
      return null
    }
    const regex = new RegExp(`^${limitedPattern}`)
    const curations = await this.collection
      .find({ _id: regex })
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

  /** @param {EntityCoordinatesSpec} coordinates */
  _getCurationId(coordinates) {
    if (!coordinates) {
      return ''
    }
    return EntityCoordinates.fromObject(coordinates).toString().toLowerCase()
  }

  /** @param {EntityCoordinates} coordinates */
  _buildContributionQuery(coordinates) {
    /** @type {Record<string, string>} */
    const result = {}
    if (coordinates.type) {
      result['files.coordinates.type'] = coordinates.type.toLowerCase()
    }
    if (coordinates.provider) {
      result['files.coordinates.provider'] = coordinates.provider.toLowerCase()
    }
    if (coordinates.namespace) {
      result['files.coordinates.namespace'] = coordinates.namespace.toLowerCase()
    }
    if (coordinates.name) {
      result['files.coordinates.name'] = coordinates.name.toLowerCase()
    }
    if (coordinates.revision) {
      result['files.revisions.revision'] = coordinates.revision.toLowerCase()
    }
    return result
  }

  /**
   * @param {CurationData[]} curations
   * @returns {Record<string, CurationRevision>}
   */
  _formatCurations(curations) {
    return curations.reduce((/** @type {Record<string, CurationRevision>} */ result, entry) => {
      for (const revision of Object.keys(entry.revisions)) {
        const coordinates = EntityCoordinates.fromObject({ ...entry.coordinates, revision }).toString()
        result[coordinates] = entry.revisions[revision]
      }
      return result
    }, {})
  }

  /** @param {EntityCoordinatesSpec} input */
  _lowercaseCoordinates(input) {
    return EntityCoordinates.fromString(EntityCoordinates.fromObject(input).toString().toLowerCase())
  }
  /** @param {string} string */
  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

export default /** @param {MongoCurationStoreOptions} options */ options => new MongoCurationStore(options)
