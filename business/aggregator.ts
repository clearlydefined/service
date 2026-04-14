// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// Responsible for taking multiple summarized responses and aggregating them into a single response
//
// The tools to consider for aggregation and their priorities can be described like this:
// aggregators: [
//   ["toolC/2.0"],
//   ["toolB/3.0", "toolB/2.1", "toolB/2.0"],
//   ["toolA"]
// ]
//
// ***** TODO don't understand this logic  *****
// Multiple tools in a single array-index (e.g. toolB-*) are mutually exclusive and you should only
// use output from the first one that, for example, if there was toolB-2.1 and toolB-2.0 output
// you would only consider the toolB-2.0 output.
//
// Tools listed as peers are considered in the order listed, for example, if toolC-2.0 and toolA
// both had data for a specific field then toolC-2.0 would take precedence. For peers, the aggregator
// does have the option of combining the output if it makes sense, for example, it could choose to
// merge the lists of copyright authors.
//
// harvest should have the form:
// {
// toolC/2.0: { /* normalized summary schema */ },
// toolA: { /* normalized summary schema */ }
// }
//
// The function should return a summary schema.
//

import type { EntityCoordinates } from '../lib/entityCoordinates.ts'
import type { Logger } from '../providers/logging/index.js'
import type { Definition } from './definitionService.ts'

import lodash from 'lodash'

const { flattenDeep, get, set, intersectionBy } = lodash

import { getLatestVersion, mergeDefinitions, setIfValue } from '../lib/utils.ts'
import logger from '../providers/logging/logger.ts'

/** Tool precedence configuration */
export type ToolPrecedence = string[][]

/** Options for the AggregationService */
export interface AggregationServiceOptions {
  precedence?: ToolPrecedence
}

/** Summarized data structure - tool -> version -> summary */
export type SummarizedData = Record<string, Record<string, any>>

/** Result of finding tool data */
export interface ToolDataResult {
  toolSpec: string
  summary: Partial<Definition>
}

/**
 * Service for aggregating summarized tool output into a single definition.
 * Handles tool precedence and merging of data from multiple sources.
 */
class AggregationService {
  options: AggregationServiceOptions
  workingPrecedence: string[] | undefined
  logger: Logger

  constructor(options: AggregationServiceOptions) {
    this.options = options
    // we take the configured precedence expected to be highest first
    this.workingPrecedence =
      options.precedence && flattenDeep(options.precedence.map(group => [...group].reverse()).reverse())
    this.logger = logger()
  }

  /** Process summarized data from multiple tools into a single definition. */
  process(summarized: SummarizedData, coordinates: EntityCoordinates): Partial<Definition> | null {
    const result: Partial<Definition> = {}
    const order = this.workingPrecedence || []
    const tools: string[] = []
    for (const tool of order) {
      const data = this._findData(tool, summarized)
      if (data) {
        tools.push(data.toolSpec)
        mergeDefinitions(result, data.summary)
      }
    }
    if (!tools.length) {
      return null
    }
    set(result, 'described.tools', tools.reverse())
    const cdSummarized = this._findData('clearlydefined', summarized)
    this._overrideDeclaredLicense(result, cdSummarized, coordinates)
    this._normalizeFiles(result, cdSummarized, coordinates)
    return result
  }

  /** Override declared license for certain component types based on ClearlyDefined data */
  _overrideDeclaredLicense(
    result: Partial<Definition>,
    cdSummarized: ToolDataResult | null,
    coordinates: EntityCoordinates
  ): void {
    const declaredByCD = cdSummarized?.summary?.licensed?.declared
    const isCrateComponent = get(coordinates, 'type') === 'crate'
    if (isCrateComponent && declaredByCD !== 'NOASSERTION') {
      // For Rust crates, leave the license declaration to the ClearlyDefined summarizer which parses Cargo.toml
      setIfValue(result, 'licensed.declared', declaredByCD)
    }
  }

  /** Search the summarized data for an entry that best matches the given tool spec */
  _findData(toolSpec: string, summarized: SummarizedData): ToolDataResult | null {
    const [tool, toolVersion] = toolSpec.split('/')
    if (!summarized[tool]) {
      return null
    }
    if (toolVersion) {
      return { toolSpec, summary: summarized[tool][toolVersion] }
    }

    const versions = Object.getOwnPropertyNames(summarized[tool])
    const latest = getLatestVersion(versions)
    return latest ? { toolSpec: `${tool}/${latest}`, summary: summarized[tool][latest] } : null
  }

  /**
   * Take the clearlydefined tool as the source of truth for file paths as it is just a recursive dir.
   * Intersect the summarized file list with the clearlydefined file list by path.
   */
  _normalizeFiles(
    result: Partial<Definition>,
    cdSummarized: ToolDataResult | null,
    coordinates: EntityCoordinates
  ): void {
    const cdFiles = get(cdSummarized, 'summary.files')
    if (!cdFiles?.length) {
      return
    }
    const difference = (result.files?.length || 0) - cdFiles.length
    if (!difference) {
      return
    }
    this.logger.info('difference between summary file count and cd file count', {
      count: difference,
      coordinates: coordinates.toString()
    })
    result.files = intersectionBy(result.files, cdFiles, 'path')
  }
}

export default (options: AggregationServiceOptions): AggregationService => new AggregationService(options)
