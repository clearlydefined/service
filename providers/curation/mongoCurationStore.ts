// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { Collection, Db, MongoClient as MongoClientType } from 'mongodb'
import { MongoClient } from 'mongodb'
import promiseRetry from 'promise-retry'
import throat from 'throat'
import type Curation from '../../lib/curation.ts'
import type { CurationData, CurationRevision } from '../../lib/curation.ts'
import type { EntityCoordinatesSpec } from '../../lib/entityCoordinates.ts'
import EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'
import type { ContributionPR } from './index.js'

const { get } = lodash

import logger from '../logging/logger.ts'

/** Options for MongoDB-backed curation store */
export interface MongoCurationStoreOptions {
  /** MongoDB connection string */
  connectionString: string
  /** Database name */
  dbName: string
  /** Collection name */
  collectionName: string
}

// TODO: implements ICurationStore once return types are aligned
class MongoCurationStore {
  declare logger: Logger
  declare options: MongoCurationStoreOptions
  declare client: MongoClientType
  declare db: Db
  declare collection: Collection<{ _id: string | number; [key: string]: unknown }>

  constructor(options: MongoCurationStoreOptions) {
    this.logger = logger()
    this.options = options
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
      } catch (error: unknown) {
        this.logger.info(`retrying mongo connection: ${(error as Error).message}`)
        retry(error)
      }
    })
  }

  /**
   * Store the given set of curations overwriting any previous content. This effectively replicates the
   * content of the files in the GitHub curation repo.
   */
  async updateCurations(curations: Curation[]): Promise<null> {
    await Promise.all(
      curations.map(
        throat(10, async curation => {
          const _id = this._getCurationId(curation.data!.coordinates!)
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
   * @param prNumber - the PR number as provided by GitHub
   * @returns the Curations found if any
   */
  getContribution(prNumber: number) {
    return this.collection.findOne({ _id: prNumber })
  }

  /**
   * Update the contribution entry for the given PR and record the associated curations -- the
   * actual file content in the PR. If the curations are not provided, just the PR data is updated,
   * any existing curation data is preserved.
   * @param pr - the PR object as provided by GitHub
   * @param curations - The set of actual proposed changes.
   */
  updateContribution(pr: ContributionPR, curations: Curation[] | null = null) {
    if (!curations?.some(curation => get(curation, 'data.coordinates') && get(curation, 'data.revisions'))) {
      return this.collection.updateOne({ _id: pr.number }, { $set: { pr: pr } }, { upsert: true })
    }
    const files = curations
      .filter(curation => get(curation, 'data.coordinates') && get(curation, 'data.revisions'))
      .map(curation => {
        return {
          path: curation.path,
          coordinates: this._lowercaseCoordinates(curation.data!.coordinates!),
          revisions: Object.keys(curation.data!.revisions!).map(revision => {
            return {
              revision: revision.toLowerCase(),
              data: curation.data!.revisions![revision]
            }
          })
        }
      })
      .filter(x => x)
    return this.collection.replaceOne({ _id: pr.number }, { _id: pr.number, pr, files }, { upsert: true })
  }

  /**
   * List all of the Curations and Contributions whose coordinates match the given partial coordinates.
   * @param coordinates - partial coordinates to look for
   * @returns the Curations and Contributions found
   */
  // TODO need to do something about paging
  async list(coordinates: EntityCoordinates) {
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

  _getCurationId(coordinates: EntityCoordinatesSpec) {
    if (!coordinates) {
      return ''
    }
    return EntityCoordinates.fromObject(coordinates)!.toString().toLowerCase()
  }

  _buildContributionQuery(coordinates: EntityCoordinates) {
    const result: Record<string, string> = {}
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

  _formatCurations(curations: CurationData[]): Record<string, CurationRevision> {
    return curations.reduce((result: Record<string, CurationRevision>, entry) => {
      for (const revision of Object.keys(entry.revisions!)) {
        const coordinates = EntityCoordinates.fromObject({ ...entry.coordinates!, revision })!.toString()
        result[coordinates] = entry.revisions![revision]
      }
      return result
    }, {})
  }

  _lowercaseCoordinates(input: EntityCoordinatesSpec) {
    return EntityCoordinates.fromString(EntityCoordinates.fromObject(input)!.toString().toLowerCase())!
  }
  _escapeRegex(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

export default (options: MongoCurationStoreOptions) => new MongoCurationStore(options)
