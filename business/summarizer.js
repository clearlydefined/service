// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for taking multiple normalized responses and summarizing them into a single response
//
// The tools to consider for summarization and their priorites can be described like this:
// summarizers: [
//   ["toolC-2.0"],
//   ["toolB-3.0", "toolB-2.1", "toolB-2.0"],
//   ["toolA"]
// ]
//
// Multiple tools in a single array-index (e.g. toolB-*) are mutually exclusive and you should only 
// use results from the first one that, for example, if there was toolB-2.1 and toolB-2.0 results
// you would only consider the toolB-2.0 results.
//
// Tools listed as peers are considered in the order listed, for example, if toolC-2.0 and toolA
// both had data for a specific field then toolC-2.0 would take preference. For peers, the summarizer
// does have the option of combining the results if it makes sense, for example, it could choose to
// merge the lists of copyright authors.
//
// harvest should have the form:
// {
// toolC-2.0: { /* normalized schema */ },
// toolA: { /* normalized schema */ } 
// }
//
// The function should return a normalized schema.
//
class SummarizerService {
  constructor(options) {
    this.options = options;
  }

  summarize(type, provider, name, revision, harvest) {

  }
}

module.exports = {
  SummarizerService: SummarizerService
}
