// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../lib/entityCoordinates.ts'

import summarizers from '../providers/summary/index.ts'

/** Summarizer function interface */
export interface Summarizer {
  summarize(coordinates: EntityCoordinates, data: any): any
}

/** Summarizer factory function type */
export type SummarizerFactory = (options: Record<string, any>) => Summarizer

/** Options for the SummaryService */
export interface SummaryServiceOptions {
  [tool: string]: Record<string, any>
}

/** Summarized data structure - tool -> version -> summary */
export type SummarizedData = Record<string, Record<string, any>>

/**
 * Service for summarizing tool output data.
 * Delegates to tool-specific summarizers to process raw harvest data.
 */
class SummaryService {
  options: SummaryServiceOptions

  constructor(options: SummaryServiceOptions) {
    this.options = options
  }

  /**
   * Summarize the data for each of the supplied data points for different versions of an
   * identified tool.
   */
  _summarizeTool(coordinates: EntityCoordinates, tool: string, data: Record<string, any>): Record<string, any> {
    if (!summarizers[tool]) {
      return data
    }
    const summarizer = summarizers[tool](this.options[tool] || {})
    return Object.getOwnPropertyNames(data).reduce(
      (result: Record<string, any>, version) => {
        result[version] = summarizer.summarize(coordinates, data[version])
        return result
      },
      {}
    )
  }

  /** Summarize all of the data for the identified component. */
  summarizeAll(coordinates: EntityCoordinates, data: SummarizedData): SummarizedData {
    return Object.getOwnPropertyNames(data || {}).reduce(
      (result: SummarizedData, tool) => {
        result[tool] = this._summarizeTool(coordinates, tool, data[tool])
        return result
      },
      {}
    )
  }
}

export default (options: SummaryServiceOptions): SummaryService => new SummaryService(options)
