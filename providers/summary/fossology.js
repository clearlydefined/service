// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { setIfValue } = require('../../lib/utils')
const { get } = require('lodash')
const correct = require('spdx-correct')

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
    setIfValue(result, 'files', this._summarizeNomosLicenseInfo(harvested.nomos.output.content))
    return result
  }

  _summarizeNomosLicenseInfo(content) {
    const files = content.split('\n')
    return files
      .map(file => {
        const path = get(/^File (.*?) contains/.exec(file), '[1]')
        let license = get(/license\(s\) (.*?)$/.exec(file), '[1]')
        if (license) license = correct(license)
        if (path && license) return { path, license }
        if (path) return { path }
      })
      .filter(e => e)
  }
}

module.exports = options => new FOSSologySummarizer(options)
