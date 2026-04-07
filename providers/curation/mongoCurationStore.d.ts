// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Collection, Db, MongoClient } from 'mongodb'
import type { Contribution, ContributionPR, CurationListResult, ICurationStore } from '..js'
import type Curation from '../../lib/curation.js'
import type { EntityCoordinates } from '../../lib/entityCoordinates.js'
import type { Logger } from '../logging/index.js'

/** Options for MongoDB-backed curation store */
export interface MongoCurationStoreOptions {
  /** MongoDB connection string */
  connectionString: string
  /** Database name */
  dbName: string
  /** Collection name */
  collectionName: string
}

/**
 * MongoDB-backed curation store. Stores curations and contributions in a single collection.
 * Curations are keyed by their lowercase coordinate string; contributions by PR number.
 */
export declare class MongoCurationStore implements ICurationStore {
  logger: Logger
  options: MongoCurationStoreOptions
  client: MongoClient
  db: Db
  collection: Collection

  constructor(options: MongoCurationStoreOptions)

  /** Connect to MongoDB and set up the collection reference. */
  initialize(): Promise<void>

  /**
   * Replace stored curations with the given set.
   *
   * @param curations - Array of Curation instances to persist
   */
  updateCurations(curations: Curation[]): Promise<null>

  /**
   * Retrieve a contribution by PR number.
   *
   * @param prNumber - The GitHub PR number
   * @returns The stored contribution document or null
   */
  getContribution(prNumber: number): Promise<Contribution | null>

  /**
   * Create or update the contribution record for a PR.
   *
   * @param pr - The PR metadata
   * @param curations - Optional curation file contents
   */
  updateContribution(pr: ContributionPR, curations?: Curation[] | null): Promise<void>

  /**
   * List curations and contributions matching the given coordinates.
   *
   * @param coordinates - Partial coordinates to search for
   * @returns Object with `curations` and `contributions`, or null if no match
   */
  list(coordinates: EntityCoordinates): Promise<CurationListResult | null>
}

/**
 * Factory function to create a MongoCurationStore instance.
 *
 * @param options - MongoDB connection and collection configuration
 * @returns A new MongoCurationStore
 */
declare function createMongoCurationStore(options: MongoCurationStoreOptions): MongoCurationStore

export default createMongoCurationStore
