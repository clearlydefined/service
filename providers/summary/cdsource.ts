// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates.ts'
import { extractDate } from '../../lib/utils.ts'
import type { SummarizerOptions } from './index.ts'

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
export class CdSourceSummarizer {
  declare options: SummarizerOptions

  constructor(options: SummarizerOptions) {
    this.options = options
  }

  summarize(_coordinates: EntityCoordinates, data: CdSourceHarvestedData): CdSourceSummaryResult {
    const result: CdSourceSummaryResult = { described: {} }
    result.described.releaseDate = extractDate(data.releaseDate)
    result.described.facets = data.facets
    return result
  }
}

export default (options?: SummarizerOptions) => new CdSourceSummarizer(options)
