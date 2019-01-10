// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { setIfValue } = require('../../lib/utils')
const SPDX = require('../../lib/spdx')
const { get } = require('lodash')

class LicenseeSummarizer {
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
    if (!harvested || !harvested.licensee || !harvested.licensee.version) throw new Error('Invalid Licensee data')
    const result = {}
    setIfValue(result, 'files', this._summarizeFiles(harvested))
    return result
  }

  _summarizeFiles(harvested) {
    const files = get(harvested, 'licensee.output.content.matched_files')
    const attachments = harvested.attachments || []
    if (!files) return null
    return files
      .map(file => {
        if (get(file, 'matcher.name') !== 'exact') return null
        if (70 > +get(file, 'matcher.confidence')) return null
        const path = file.filename
        const attachment = attachments.find(x => x.path === path)
        const license = SPDX.normalize(file.matched_license)
        if (path && license && license !== 'NOASSERTION') {
          const resultFile = { path, license, natures: ['license'] }
          setIfValue(resultFile, 'token', get(attachment, 'token'))
          return resultFile
        }
      })
      .filter(e => e)
  }
}

module.exports = options => new LicenseeSummarizer(options)
