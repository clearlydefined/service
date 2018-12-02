// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { normalizeSpdx, mergeDefinitions } = require('../../lib/utils')
const { get } = require('lodash')

class FOSSologySummarizer {
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param {EntitySpec} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool ouptuts related to the idenified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    if (!harvested || !harvested.nomos || !harvested.nomos.version) throw new Error('Not valid FOSSology data')
    const result = {}
    this._summarizeNomos(result, harvested)
    this._summarizeMonk(result, harvested)
    this._summarizeCopyright(result, harvested)
    return result
  }

  _summarizeNomos(result, output) {
    const content = get(output, 'nomos.output.content')
    if (!content) return
    const files = content
      .split('\n')
      .map(file => {
        const path = get(/^File (.*?) contains/.exec(file), '[1]')
        let license = SPDX.normalize(get(/license\(s\) (.*?)$/.exec(file), '[1]'))
        if (path && license && license !== 'NOASSERTION') return { path, license }
        if (path) return { path }
      })
      .filter(e => e)
    mergeDefinitions(result, { files })
  }

  _summarizeMonk(result, output) {
    const content = get(output, 'monk.output.content')
    if (!content) return
    const files = content
      .map(entry => {
        const { path, output } = entry
        // TODO skip imprecise matches for now
        if (output.type !== 'full') return null
        const license = normalizeSpdx(output.shortname)
        if (path && license) return { path, license }
        if (path) return { path }
      })
      .filter(e => e)
    mergeDefinitions(result, { files })
  }

  _summarizeCopyright(result, output) {
    const content = get(output, 'copyright.output.content')
    if (!content) return
    const files = content
      .map(entry => {
        const { path, output } = entry
        if (!output.results) return null
        // TODO there is a `type` prop for each entry, not sure what that is or what to do with it. Investigate
        const copyrights = output.results.map(result => result.content)
        if (path && copyrights) return { path, copyrights }
        if (path) return { path }
      })
      .filter(e => e)
    mergeDefinitions(result, { files })
  }
}

module.exports = options => new FOSSologySummarizer(options)
