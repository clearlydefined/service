// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// Responsible for taking multiple summarized responses and aggregating them into a single response
//
// The tools to consider for aggregation and their priorites can be described like this:
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

const extend = require('extend')
const utils = require('../lib/utils')
const _ = require('lodash')

class AggregationService {
  constructor(options) {
    this.options = options
    this.workingPrecedence = _.flattenDeep(options.precedence.map(group => [...group].reverse()).reverse())
  }

  process(coordinates, summarized) {
    let result = {}
    const order = this.workingPrecedence
    const tools = []
    order.forEach(tool => {
      const data = this.findData(tool, summarized)
      if (data) {
        tools.push(data.toolSpec)
        extend(true, result, data.summary)
      }
    })
    result.described = result.described || {}
    result.described.tools = tools.reverse()
    return result
  }

  // search the summarized data for an entry that best matches the given tool spec
  findData(toolSpec, summarized) {
    const [tool, toolVersion] = toolSpec.split('/')
    if (!summarized[tool]) return null
    if (toolVersion) return { toolSpec, summary: summarized[tool][toolVersion] }

    const versions = Object.getOwnPropertyNames(summarized[tool])
    const latest = utils.getLatestVersion(versions)
    return latest ? { toolSpec: `${tool}/${latest}`, summary: summarized[tool][latest] } : null
  }
}

module.exports = options => new AggregationService(options)
