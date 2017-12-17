// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for taking multiple summarized responses and aggregating them into a single response
//
// The tools to consider for aggregation and their priorites can be described like this:
// aggregators: [
//   ["toolC--2.0"],
//   ["toolB--3.0", "toolB--2.1", "toolB--2.0"],
//   ["toolA"]
// ]
//
// ***** TODO don't understand this logic  *****
// Multiple tools in a single array-index (e.g. toolB-*) are mutually exclusive and you should only 
// use results from the first one that, for example, if there was toolB-2.1 and toolB-2.0 results
// you would only consider the toolB-2.0 results.
//
// Tools listed as peers are considered in the order listed, for example, if toolC-2.0 and toolA
// both had data for a specific field then toolC-2.0 would take precedence. For peers, the aggregator
// does have the option of combining the results if it makes sense, for example, it could choose to
// merge the lists of copyright authors.
//
// harvest should have the form:
// {
// toolC--2.0: { /* normalized summary schema */ },
// toolA: { /* normalized summary schema */ } 
// }
//
// The function should return a summary schema.
//
class AggregationService {
  constructor(options) {
    this.options = options;
  }

  process(packageCoordinates, summarized) {
    // TODO for now just return the results for the latest version of the first tool.
    const tool = this.options.precedence[0][0];
    return summarized[tool];
  }

  // search the summarized data for an entry that best matches the given tool spec
  findData(toolSpec, summarized) {
    const ordered = Object.getOwnPropertyNames(summarized)
      .filter(name => name.startsWith(toolSpec))
      .sort((spec1, spec2) => this.getSpecVersion(spec1) - this.getSpecVersion(spec2));
    return ordered.length ? summarize[ordered[0]] : null;
  }

  getSpecVersion(spec) {
    const index = spec.lastIndexOf('--');
    return index === -1 ? "0" : spec.substring(index);
  }
}

module.exports = (options) => new AggregationService(options);