// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates'
import type { SummarizerOptions } from './index'

/** Harvested data structure for CdSource tool */
export interface CdSourceHarvestedData {
  releaseDate?: string
  facets?: Record<string, string[]>
  [key: string]: unknown
}

/** Result of CdSource summarization (partial Definition) */
export interface CdSourceSummaryResult {
  described: {
    releaseDate?: string | null
    facets?: Record<string, string[]>
  }
}

/**
 * CdSource summarizer class that processes harvested data from the ClearlyDefined
 * source tool. Extracts basic release date and facet information.
 */
export declare class CdSourceSummarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /**
   * Creates a new CdSourceSummarizer instance
   *
   * @param options - Configuration options for the summarizer
   */
  constructor(options: SummarizerOptions)

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param coordinates - The entity for which we are summarizing
   * @param data - The set of raw tool outputs related to the identified entity
   * @returns A summary of the given raw information
   */
  summarize(coordinates: EntityCoordinates, data: CdSourceHarvestedData): CdSourceSummaryResult
}

/**
 * Factory function that creates a CdSourceSummarizer instance
 *
 * @param options - Configuration options for the summarizer
 * @returns A new CdSourceSummarizer instance
 */
declare function cdsourceSummarizerFactory(options?: SummarizerOptions): CdSourceSummarizer

export = cdsourceSummarizerFactory
