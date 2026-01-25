// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../lib/entityCoordinates'
import type { Definition, DefinitionFile } from './definitionService'
import type { Logger } from '../providers/logging'

/**
 * Tool precedence configuration.
 * Each group contains tool specs that are mutually exclusive.
 * Groups are processed in order, with earlier groups taking precedence.
 */
export type ToolPrecedence = string[][]

/** Options for the AggregationService */
export interface AggregationServiceOptions {
  /**
   * Tool precedence configuration.
   * Expected to be highest priority first.
   */
  precedence?: ToolPrecedence
}

/** Summarized data structure - tool -> version -> summary */
export type SummarizedData = Record<string, Record<string, any>>

/** Result of finding tool data */
export interface ToolDataResult {
  /** The tool specification (e.g., "scancode/3.0") */
  toolSpec: string
  /** The summary data for this tool version */
  summary: Partial<Definition>
}

/**
 * Service for aggregating summarized tool output into a single definition.
 * Handles tool precedence and merging of data from multiple sources.
 */
export declare class AggregationService {
  /** Configuration options */
  protected options: AggregationServiceOptions

  /** Flattened precedence list for processing */
  protected workingPrecedence: string[] | undefined

  /** Logger instance */
  protected logger: Logger

  /**
   * Creates a new AggregationService instance
   *
   * @param options - Configuration options including tool precedence
   */
  constructor(options: AggregationServiceOptions)

  /**
   * Process summarized data from multiple tools into a single definition.
   *
   * @param summarized - Summarized data from all tools
   * @param coordinates - The component coordinates
   * @returns The aggregated partial definition, or null if no tools contributed
   */
  process(summarized: SummarizedData, coordinates: EntityCoordinates): Partial<Definition> | null
}

/**
 * Factory function to create an AggregationService instance
 *
 * @param options - Configuration options including tool precedence
 * @returns A new AggregationService instance
 */
declare function createAggregationService(options: AggregationServiceOptions): AggregationService

export default createAggregationService
export = createAggregationService
