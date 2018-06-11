// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, remove, set, last, pullAllWith, isEqual } = require('lodash')
const minimatch = require('minimatch')

class ScanCodeSummarizer {
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
    if (!harvested || !harvested.content || !harvested.content.scancode_version)
      throw new Error('Not valid ScanCode data')

    if (!facets)
      // ScanCode output never has facet info in it
      return {}
    const result = {}
    this.addDescribedInfo(result, coordinates, harvested)
    const declaredLicense =
      this._summarizeDeclaredLicenseInfo(harvested.content.files) || this._summarizePackageInfo(harvested.content.files)
    this._setIfValue(result, 'licensed.declared', declaredLicense)
    result.files = this._summarizeFileInfo(harvested.content.files)
    const buckets = this.computeFileBuckets([...result.files], facets)
    for (const facet in buckets)
      this._setIfValue(result, `licensed.facets.${facet}`, this._summarizeFacetInfo(facet, buckets[facet]))
    return result
  }

  computeFileBuckets(files, facets) {
    const facetList = Object.getOwnPropertyNames(facets)
    remove(facetList, 'core')
    if (facetList.length === 0) return { core: files }
    const result = { core: [...files] }
    for (const facet in facetList) {
      const facetKey = facetList[facet]
      const filters = facets[facetKey]
      if (!filters || filters.length === 0) break
      result[facetKey] = files.filter(file => filters.some(filter => minimatch(file.path, filter)))
      pullAllWith(result.core, result[facetKey], isEqual)
    }
    return result
  }

  addDescribedInfo(result, coordinates, harvested) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) result.described = { releaseDate: releaseDate.trim() }
  }

  _summarizeFacetInfo(facet, facetFiles) {
    if (!facetFiles || facetFiles.length === 0) return null
    const attributions = new Set()
    const licenseExpressions = new Set()
    let unknownParties = 0
    let unknownLicenses = 0
    for (let file of facetFiles) {
      file.license ? licenseExpressions.add(file.license) : unknownLicenses++
      file.attributions ? this._addArrayToSet(file.attributions, attributions) : unknownParties++
      // tag the file with the current facet
      file.facets = file.facets || []
      file.facets.push(facet)
    }
    const result = {
      attribution: {
        unknown: unknownParties
      },
      discovered: {
        unknown: unknownLicenses
      },
      files: facetFiles.length
    }
    this._setIfValue(result, 'attribution.parties', this._setToArray(attributions))
    this._setIfValue(result, 'discovered.expressions', this._setToArray(licenseExpressions))
    return result
  }

  _setIfValue(target, path, value) {
    if (!value) return
    set(target, path, value)
  }

  _summarizeDeclaredLicenseInfo(files) {
    for (let file of files) {
      const pathArray = file.path.split('/')
      const baseName = last(pathArray)
      const isLicense = ['license', 'license.txt', 'license.md', 'license.html'].includes(baseName.toLowerCase())
      if (isLicense && file.licenses) {
        // Find the first license file and treat it as the authority
        const declaredLicenses = this._addArrayToSet(file.licenses, new Set(), license => license.spdx_license_key)
        return this._toExpression(declaredLicenses)
      }
    }
    return null
  }

  _summarizePackageInfo(files) {
    for (let file of files) {
      const asserted = get(file, 'packages[0].asserted_licenses')
      // Find the first package file and treat it as the authority
      if (asserted) {
        const packageLicenses = this._addArrayToSet(
          asserted,
          new Set(),
          license => license.license || license.spdx_license_key
        )
        return this._toExpression(packageLicenses)
      }
    }
    return null
  }

  _summarizeFileInfo(files) {
    return files.map(file => {
      const asserted = get(file, 'packages[0].asserted_licenses')
      const fileLicense = asserted || file.licenses
      const licenses = this._addArrayToSet(
        fileLicense,
        new Set(),
        license => license.license || license.spdx_license_key
      )
      const licenseExpression = this._toExpression(licenses)
      const attributions = this._collectAttributions(file.copyrights)
      const result = { path: file.path }
      this._setIfValue(result, 'license', licenseExpression)
      this._setIfValue(result, 'attributions', attributions)
      return result
    })
  }

  _toExpression(licenses) {
    if (!licenses) return null
    const list = this._setToArray(licenses)
    return list ? list.join(' and ') : null
  }

  _setToArray(licenses) {
    const result = Array.from(licenses)
      .filter(e => e)
      .sort()
    return result.length === 0 ? null : result
  }

  _collectAttributions(copyrights, holders) {
    if (!copyrights || !copyrights.length) return null
    return this._setToArray(copyrights.reduce((result, entry) => this._addArrayToSet(entry.holders, result), new Set()))
  }

  _addArrayToSet(array, set, valueExtractor) {
    if (!array || !array.length) return set

    valueExtractor = valueExtractor || (value => value)
    for (let entry of array) set.add(valueExtractor(entry))
    return set
  }
}

module.exports = options => new ScanCodeSummarizer(options)
