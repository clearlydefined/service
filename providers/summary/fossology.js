// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { set } = require('lodash')
const base64 = require('base-64')

class FOSSologySummarizer {
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates using the supplied facet info to
   * bucketize results. If `facets` is falsy, only return the extracted `facets` portion of the raw
   * data, if any.
   * @param {EntitySpec} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool ouptuts related to the idenified entity
   * @param {Facets} facets - an object detailing the facets to group by.
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested, facets = {}) {
    if (!harvested || !harvested.nomos || !harvested.nomos.version)
      throw new Error('Not valid FOSSology data')

    return {nomos: this._summarizeNomosLicenseInfo(harvested.nomos.output.content)}
  }

  _setIfValue(target, path, value) {
    if (!value) return
    set(target, path, value)
  }

  _summarizeNomosLicenseInfo(content) {
    const nomosOutput = base64.decode(content)
    const files = nomosOutput.split("\n")
    return files.map(file => {
      const path = file.match(/(?<=File ).*(?= contains)/g)
      const license = file.match(/(?<=license\(s\) ).*/g)
      const result = {path: path }
      this._setIfValue(result, 'license', license)
      return result 
    })
  }
}

module.exports = options => new FOSSologySummarizer(options)
