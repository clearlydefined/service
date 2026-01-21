// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../lib/entityCoordinates'

/** Summarizer function interface */
export interface Summarizer {
  /**
   * Summarize tool output for a component
   *
   * @param coordinates - The component being summarized
   * @param data - The raw tool output data
   * @returns The summarized data
   */
  summarize(coordinates: EntityCoordinates, data: any): any
}

/** Summarizer factory function type */
export type SummarizerFactory = (options: Record<string, any>) => Summarizer

/** Options for the SummaryService */
export interface SummaryServiceOptions {
  /** Tool-specific options, keyed by tool name */
  [tool: string]: Record<string, any>
}

/** Summarized data structure - tool -> version -> summary */
export type SummarizedData = Record<string, Record<string, any>>

/**
 * Service for summarizing tool output data.
 * Delegates to tool-specific summarizers to process raw harvest data.
 */
export declare class SummaryService {
  /** Configuration options */
  protected options: SummaryServiceOptions

  /**
   * Creates a new SummaryService instance
   *
   * @param options - Tool-specific configuration options
   */
  constructor(options: SummaryServiceOptions)

  /**
   * Summarize all of the data for the identified component.
   *
   * @param coordinates - The component being summarized
   * @param data - The raw tool output data, keyed by tool name and version
   * @returns Summarized data for all tools
   */
  summarizeAll(coordinates: EntityCoordinates, data: SummarizedData): SummarizedData
}

/**
 * Factory function to create a SummaryService instance
 *
 * @param options - Tool-specific configuration options
 * @returns A new SummaryService instance
 */
declare function createSummaryService(options: SummaryServiceOptions): SummaryService

export default createSummaryService
export = createSummaryService
