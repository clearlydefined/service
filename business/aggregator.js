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

/**
 * @typedef {import('./aggregator').AggregationServiceOptions} AggregationServiceOptions
 * @typedef {import('./aggregator').SummarizedData} SummarizedData
 * @typedef {import('./aggregator').ToolDataResult} ToolDataResult
 * @typedef {import('./definitionService').Definition} Definition
 * @typedef {import('../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('../providers/logging').Logger} Logger
 */

const { getLatestVersion, mergeDefinitions } = require('../lib/utils')
const { flattenDeep, get, set, intersectionBy } = require('lodash')
const logger = require('../providers/logging/logger')
const { setIfValue } = require('../lib/utils')

/**
 * Service for aggregating summarized tool output into a single definition.
 * Handles tool precedence and merging of data from multiple sources.
 */
class AggregationService {
  /**
   * Creates a new AggregationService instance
   * @param {AggregationServiceOptions} options - Configuration options including tool precedence
   */
  constructor(options) {
    this.options = options
    // we take the configured precedence expected to be highest first
    this.workingPrecedence =
      options.precedence && flattenDeep(options.precedence.map(group => [...group].reverse()).reverse())
    /** @type {Logger} */
    this.logger = logger()
  }

  /**
   * Process summarized data from multiple tools into a single definition.
   * @param {SummarizedData} summarized - Summarized data from all tools
   * @param {EntityCoordinates} coordinates - The component coordinates
   * @returns {Partial<Definition> | null} The aggregated partial definition, or null if no tools contributed
   */
  process(summarized, coordinates) {
    /** @type {Partial<Definition>} */
    const result = {}
    const order = this.workingPrecedence || []
    /** @type {string[]} */
    const tools = []
    order.forEach(tool => {
      const data = this._findData(tool, summarized)
      if (data) {
        tools.push(data.toolSpec)
        mergeDefinitions(result, data.summary)
      }
    })
    if (!tools.length) return null
    set(result, 'described.tools', tools.reverse())
    const cdSummarized = this._findData('clearlydefined', summarized)
    this._overrideDeclaredLicense(result, cdSummarized, coordinates)
    this._normalizeFiles(result, cdSummarized, coordinates)
    return result
  }

  /**
   * Override declared license for certain component types based on ClearlyDefined data
   * @param {Partial<Definition>} result - The aggregated result
   * @param {ToolDataResult | null} cdSummarized - ClearlyDefined summarized data
   * @param {EntityCoordinates} coordinates - The component coordinates
   * @private
   */
  _overrideDeclaredLicense(result, cdSummarized, coordinates) {
    const declaredByCD = cdSummarized?.summary?.licensed?.declared
    const isCrateComponent = get(coordinates, 'type') === 'crate'
    if (isCrateComponent && declaredByCD !== 'NOASSERTION') {
      // For Rust crates, leave the license declaration to the ClearlyDefined summarizer which parses Cargo.toml
      setIfValue(result, 'licensed.declared', declaredByCD)
    }
  }

  /**
   * Search the summarized data for an entry that best matches the given tool spec
   * @param {string} toolSpec - The tool specification (e.g., "scancode/3.0" or "scancode")
   * @param {SummarizedData} summarized - The summarized data
   * @returns {ToolDataResult | null} The matching tool data or null if not found
   * @private
   */
  _findData(toolSpec, summarized) {
    const [tool, toolVersion] = toolSpec.split('/')
    if (!summarized[tool]) return null
    if (toolVersion) return { toolSpec, summary: summarized[tool][toolVersion] }

    const versions = Object.getOwnPropertyNames(summarized[tool])
    const latest = getLatestVersion(versions)
    return latest ? { toolSpec: `${tool}/${latest}`, summary: summarized[tool][latest] } : null
  }

  /**
   * Take the clearlydefined tool as the source of truth for file paths as it is just a recursive dir
   * Intersect the summarized file list with the clearlydefined file list by path
   * @param {Partial<Definition>} result - The aggregated result
   * @param {ToolDataResult | null} cdSummarized - ClearlyDefined summarized data
   * @param {EntityCoordinates} coordinates - The component coordinates
   * @private
   */
  _normalizeFiles(result, cdSummarized, coordinates) {
    const cdFiles = get(cdSummarized, 'summary.files')
    if (!cdFiles || !cdFiles.length) return
    const difference = (result.files?.length || 0) - cdFiles.length
    if (!difference) return
    this.logger.info('difference between summary file count and cd file count', {
      count: difference,
      coordinates: coordinates.toString()
    })
    result.files = intersectionBy(result.files, cdFiles, 'path')
  }
}

/**
 * Factory function to create an AggregationService instance
 * @param {AggregationServiceOptions} options - Configuration options including tool precedence
 * @returns {AggregationService} A new AggregationService instance
 */
module.exports = options => new AggregationService(options)
