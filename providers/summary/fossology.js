// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { mergeDefinitions, setIfValue, isLicenseFile } = require('../../lib/utils')
const SPDX = require('@clearlydefined/spdx')
const { get, uniq } = require('lodash')

const noOpLicenseIds = new Set(['No_license_found', 'See-file', 'See-URL'])

class FOSSologySummarizer {
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param {EntitySpec} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool ouptuts related to the identified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    const result = {}
    // TODO currently definition merging does not union values (licenses, copyrights) at the file level.
    // That means the order here matters. Later merges overwrite earlier. So here we are explicitly taking
    // Nomos over Monk. The Copyright info should be orthogonal so order does not matter. In the future
    // we should resolve this merging problem but it's likely to be hard in general.
    this._summarizeMonk(result, harvested)
    this._summarizeNomos(result, harvested)
    this._summarizeCopyright(result, harvested)
    this._declareLicense(coordinates, result)
    return result
  }

  _summarizeNomos(result, output) {
    const content = get(output, 'nomos.output.content')
    if (!content) return
    const files = content
      .split('\n')
      .map(file => {
        // File package/dist/ajv.min.js contains license(s) No_license_found
        const match = /^File (.*?) contains license\(s\) (.*?)$/.exec(file)
        if (!match) return null
        const [, path, rawLicense] = match
        const license = noOpLicenseIds.has(rawLicense) ? null : SPDX.normalize(rawLicense)
        if (path && license) return { path, license }
        if (path) return { path }
      })
      .filter(e => e)
    mergeDefinitions(result, { files })
  }

  _summarizeMonk(result, output) {
    const content = get(output, 'monk.output.content')
    if (!content) return
    const files = content
      .split('\n')
      .map(file => {
        const fullMatch = /^found full match between \\"(.*?)\\" and \\"(.*?)\\"/.exec(file)
        if (!fullMatch) return null
        const [, path, rawLicense] = fullMatch
        const license = SPDX.normalize(rawLicense)
        if (path && license) return { path, license }
        if (path) return { path }
      })
      .filter(e => e)
    mergeDefinitions(result, { files })
  }

  _summarizeCopyright(/*result, output*/) {
    // see https://github.com/fossology/fossology/issues/1292
    return
    // const content = get(output, 'copyright.output.content')
    // if (!content) return
    // const files = content
    //   .map(entry => {
    //     const { path, output } = entry
    //     if (!output.results) return null
    //     const attributions = uniq(
    //       output.results
    //         .filter(result => result.type === 'statement')
    //         .map(result => result.content)
    //         .filter(e => e)
    //     )
    //     const file = { path }
    //     setIfValue(file, 'attributions', attributions)
    //     return file
    //   })
    //   .filter(e => e)
    // mergeDefinitions(result, { files })
  }

  _declareLicense(coordinates, result) {
    if (!result.files) return
    // For Rust crates, leave the license declaration to the ClearlyDefined summarizer which parses Cargo.toml
    if (get(coordinates, 'type') === 'crate') return
    // if we know this is a license file by the name of it and it has a license detected in it
    // then let's declare the license for the component
    const licenses = uniq(
      result.files.filter(file => file.license && isLicenseFile(file.path, coordinates)).map(file => file.license)
    )
    setIfValue(result, 'licensed.declared', licenses.join(' AND '))
  }
}

module.exports = options => new FOSSologySummarizer(options)
