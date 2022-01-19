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

const { getLatestVersion, mergeDefinitions } = require('../lib/utils')
const { flattenDeep, get, set, intersectionBy } = require('lodash')
const logger = require('../providers/logging/logger')

class AggregationService {
  constructor(options) {
    this.options = options
    // we take the configured precedence expected to be highest first
    this.workingPrecedence =
      options.precedence && flattenDeep(options.precedence.map(group => [...group].reverse()).reverse())
    this.logger = logger()
  }

  process(summarized, coordinates) {
    const result = {}
    const order = this.workingPrecedence || []
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
    this._normalizeFiles(result, summarized, coordinates)
    return result
  }

  // search the summarized data for an entry that best matches the given tool spec
  _findData(toolSpec, summarized) {
    const [tool, toolVersion] = toolSpec.split('/')
    if (!summarized[tool]) return null
    if (toolVersion) return { toolSpec, summary: summarized[tool][toolVersion] }

    const versions = Object.getOwnPropertyNames(summarized[tool])
    const latest = getLatestVersion(versions)
    return latest ? { toolSpec: `${tool}/${latest}`, summary: summarized[tool][latest] } : null
  }

  /*
   * Take the clearlydefined tool as the source of truth for file paths as it is just a recursive dir
   * Intersect the summarized file list with the clearlydefined file list by path
   */
  _normalizeFiles(result, summarized, coordinates) {
    const cdFiles = get(this._findData('clearlydefined', summarized), 'summary.files')
    if (!cdFiles || !cdFiles.length) return
    const difference = result.files.length - cdFiles.length
    if (!difference) return
    this.logger.info('difference between summary file count and cd file count', {
      count: difference,
      coordinates: coordinates.toString()
    })
    result.files = intersectionBy(result.files, cdFiles, 'path')
  }
}

module.exports = options => new AggregationService(options)
