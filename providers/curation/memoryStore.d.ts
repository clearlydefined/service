// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Contribution, ContributionPR, ICurationStore } from './index.js'
import type Curation from '../../lib/curation.ts'
import type { CurationData } from '../../lib/curation.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'

/**
 * In-memory curation store used for testing.
 * Implements the same interface as MongoCurationStore but keeps everything in plain objects.
 */
export declare class MemoryStore implements ICurationStore {
  logger: Logger
  options: Record<string, unknown>
  curations: Record<string, CurationData>
  contributions: Record<number, Contribution>

  constructor(options?: Record<string, unknown>)

  initialize(): void

  /**
   * Store the given curations, keyed by their lowercase coordinate string.
   *
   * @param curations - Array of Curation instances whose `.data` will be stored
   */
  updateCurations(curations: Curation[]): void

  /**
   * Retrieve a contribution by PR number.
   *
   * @param prNumber - The GitHub PR number
   * @returns The stored contribution or undefined
   */
  getContribution(prNumber: number): Contribution | null

  /**
   * Create or update the contribution record for a PR.
   *
   * @param pr - The PR metadata
   * @param curations - Optional curation file contents
   */
  updateContribution(pr: ContributionPR, curations?: Curation[] | null): void

  /**
   * List curations whose coordinate key starts with the given coordinates.
   *
   * @param coordinates - Partial coordinates to match
   * @returns Array of matching CurationData entries
   */
  list(coordinates: EntityCoordinates): CurationData[]

  /**
   * List curations for multiple coordinates at once.
   *
   * @param coordinatesList - Array of coordinates to look up
   * @returns Map of coordinate string → CurationData array
   */
  listAll(coordinatesList: EntityCoordinates[]): Record<string, CurationData[]>
}

/**
 * Factory function to create a MemoryStore instance.
 *
 * @param options - Optional configuration
 * @returns A new MemoryStore
 */
declare function createMemoryStore(options?: Record<string, unknown>): MemoryStore

export default createMemoryStore
