// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates'
import type { FileEntry } from '../../lib/utils'
import type { SummarizerOptions } from './index'

/** FOSSology Nomos output */
export interface FossologyNomosOutput {
  output?: {
    content?: string
  }
  [key: string]: unknown
}

/** FOSSology Monk output */
export interface FossologyMonkOutput {
  output?: {
    content?: string
  }
  [key: string]: unknown
}

/** FOSSology Copyright output (currently not used) */
export interface FossologyCopyrightOutput {
  output?: {
    content?: {
      path: string
      output: {
        results?: { type: string; content?: string }[]
      }
    }[]
  }
  [key: string]: unknown
}

/** Harvested data structure for FOSSology tool */
export interface FossologyHarvestedData {
  nomos?: FossologyNomosOutput
  monk?: FossologyMonkOutput
  copyright?: FossologyCopyrightOutput
  [key: string]: unknown
}

/** Result of FOSSology summarization (partial Definition) */
export interface FossologySummaryResult {
  licensed?: {
    declared?: string
  }
  files?: FileEntry[]
}

/**
 * FOSSology summarizer class that processes harvested data from FOSSology tools.
 * Combines license information from Nomos and Monk scanners.
 */
export declare class FOSSologySummarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /**
   * Creates a new FOSSologySummarizer instance
   *
   * @param options - Configuration options for the summarizer
   */
  constructor(options: SummarizerOptions)

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param coordinates - The entity for which we are summarizing
   * @param harvested - The set of raw tool outputs related to the identified entity
   * @returns A summary of the given raw information
   */
  summarize(coordinates: EntityCoordinates, harvested: FossologyHarvestedData): FossologySummaryResult

  /**
   * Summarizes Nomos scanner output
   *
   * @param result - The result object to modify
   * @param output - The harvested data
   */
  _summarizeNomos(result: FossologySummaryResult, output: FossologyHarvestedData): void

  /**
   * Summarizes Monk scanner output
   *
   * @param result - The result object to modify
   * @param output - The harvested data
   */
  _summarizeMonk(result: FossologySummaryResult, output: FossologyHarvestedData): void

  /**
   * Summarizes copyright scanner output (currently a no-op due to FOSSology issue)
   *
   * @param result - The result object to modify
   * @param output - The harvested data
   */
  _summarizeCopyright(result: FossologySummaryResult, output: FossologyHarvestedData): void

  /**
   * Declares license from analyzed license files
   *
   * @param coordinates - The entity coordinates
   * @param result - The result object to modify
   */
  _declareLicense(coordinates: EntityCoordinates, result: FossologySummaryResult): void
}

/**
 * Factory function that creates a FOSSologySummarizer instance
 *
 * @param options - Configuration options for the summarizer
 * @returns A new FOSSologySummarizer instance
 */
declare function fossologySummarizerFactory(options?: SummarizerOptions): FOSSologySummarizer

export = fossologySummarizerFactory
