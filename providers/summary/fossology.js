// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { set } = require('lodash')
const { setIfValue } = require('../../lib/utils')
const base64 = require('base-64')

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
    if (!harvested || !harvested.nomos || !harvested.nomos.version)
      throw new Error('Not valid FOSSology data')

    return {nomos: this._summarizeNomosLicenseInfo(harvested.nomos.output.content)}
  }

  _summarizeNomosLicenseInfo(content) {
    const nomosOutput = base64.decode(content)
    const files = nomosOutput.split("\n")
    return files.map(file => {
      const path = file.match(/(?<=File ).*(?= contains)/g)
      const license = file.match(/(?<=license\(s\) ).*/g)
      if (path) {
        const result = {path: path.join() }
        setIfValue(result, 'license', license.join())
        return result
      }
    })
  }
}

module.exports = options => new FOSSologySummarizer(options)
