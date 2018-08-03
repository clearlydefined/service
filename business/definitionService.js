// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Readable = require('stream').Readable
const throat = require('throat')
const { get, union, remove, pullAllWith, isEqual } = require('lodash')
const EntityCoordinates = require('../lib/entityCoordinates')
const { setIfValue, setToArray, addArrayToSet } = require('../lib/utils')
const minimatch = require('minimatch')
const he = require('he')

class DefinitionService {
  constructor(harvest, summary, aggregator, curation, store, search) {
    this.harvestService = harvest
    this.summaryService = summary
    this.aggregationService = aggregator
    this.curationService = curation
    this.definitionStore = store
    this.search = search
  }

  /**
   * Get the final representation of the specified definition and optionally apply the indicated
   * curation.
   *
   * @param {EntityCoordinates} coordinates - The entity for which we are looking for a curation
   * @param {(number | string | Summary)} [curationSpec] - A PR number (string or number) for a proposed
   * curation or an actual curation object.
   * @param {bool} force - whether or not to force re-computation of the requested definition
   * @returns {Definition} The fully rendered definition
   */
  async get(coordinates, pr = null, force = false) {
    if (pr) {
      const curation = this.curationService.get(coordinates, pr)
      return this.compute(coordinates, curation)
    }
    const definitionCoordinates = this._getDefinitionCoordinates(coordinates)
    const existing = force ? null : await this.definitionStore.get(definitionCoordinates)
    return this._cast(existing || (await this.computeAndStore(coordinates)))
  }

  // ensure the defintion is a properly classed object
  _cast(definition) {
    definition.coordinates = EntityCoordinates.fromObject(definition.coordinates)
    return definition
  }

  /**
   * Get all of the definition entries available for the given coordinates. The coordinates must be
   * specified down to the revision. The result will have an entry per discovered definition.
   *
   * @param {*} coordinatesList - an array of coordinate paths to list
   * @param {bool} force - whether or not to force re-computation of the requested definitions
   * @returns A list of all components that have definitions and the defintions that are available
   */
  async getAll(coordinatesList, force = false) {
    const result = {}
    const promises = coordinatesList.map(
      throat(10, async coordinates => {
        const definition = await this.get(coordinates, null, force)
        if (!definition) return
        const key = definition.coordinates.toString()
        result[key] = definition
      })
    )
    await Promise.all(promises)
    return result
  }

  /** Get a list of coordinates for all known definitions that match the given coordinates
   * @param {EntityCoordinates} coordinates - the coordinates to query
   * @returns {String[]} the list of all coordinates for all discovered definitions
   */
  async list(coordinates, recompute = false) {
    if (recompute) {
      const curated = await this.curationService.list(coordinates)
      const harvest = await this.harvestService.list(coordinates)
      return union(harvest, curated)
    }
    return this.definitionStore.list(coordinates)
  }

  /**
   * Invalidate the definition for the identified component. This flushes any caches and pre-computed
   * results. The definition will be recomputed on or before the next use.
   *
   * @param {Coordinates} coordinates - individual or array of coordinates to invalidate
   */
  invalidate(coordinates) {
    const coordinateList = Array.isArray(coordinates) ? coordinates : [coordinates]
    return Promise.all(
      coordinateList.map(
        throat(10, async coordinates => {
          const definitionCoordinates = this._getDefinitionCoordinates(coordinates)
          try {
            await this.definitionStore.delete(definitionCoordinates)
            return this.search.delete(definitionCoordinates)
          } catch (error) {
            if (!['ENOENT', 'BlobNotFound'].includes(error.code)) throw error
          }
        })
      )
    )
  }

  async computeAndStore(coordinates) {
    const definition = await this.compute(coordinates)
    const stream = new Readable()
    stream.push(JSON.stringify(definition, null, 2))
    stream.push(null) // end of stream
    const definitionCoordinates = this._getDefinitionCoordinates(coordinates)
    await this.definitionStore.store(definitionCoordinates, stream)
    await this.search.store(definition)
    return definition
  }

  /**
   * Compute the final representation of the specified definition and optionally apply the indicated
   * curation.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation
   * @param {(number | string | Summary)} [curationSpec] - A PR number (string or number) for a proposed
   * curation or an actual curation object.
   * @returns {Definition} The fully rendered definition
   */
  async compute(coordinates, curationSpec) {
    const curation = await this.curationService.get(coordinates, curationSpec)
    const raw = await this.harvestService.getAll(coordinates)
    const summarized = await this.summaryService.summarizeAll(coordinates, raw)
    const aggregated = await this.aggregationService.process(coordinates, summarized)
    const definition = await this.curationService.apply(coordinates, curation, aggregated)
    this._ensureFacets(coordinates, definition)
    this._ensureCurationInfo(definition, curation)
    this._ensureSourceLocation(coordinates, definition)
    this._ensureCoordinates(definition)
    definition.score = this.computeScore(definition)
    return definition
  }

  /**
   * Given a defintion, calculate a score for the definition
   * @param {Defition} defintion
   * @returns {number} The score for the definition
   */
  computeScore(definition) {
    // @todo we need to flesh this out
    // For now it just checks that a license and copyright holders are present
    const hasLicense = get(definition, 'licensed.declared')
    const hasAttributionParties = get(definition, 'licensed.attribution.parties[0]')
    if (hasLicense && hasAttributionParties) return 2
    if (hasLicense || hasAttributionParties) return 1
    return 0
  }

  /**
   * Suggest a set of defintion coordinates that match the given pattern. Only existing definitions are searched.
   * @param {String} pattern - A pattern to look for in the coordinates of a definition
   * @returns {String[]} The list of suggested coordinates found
   */
  suggestCoordinates(pattern) {
    return this.search.suggestCoordinates(pattern)
  }

  // helper method to prime the search store while get the system up and running. Should not be
  // needed in general.
  // mode can be definitions or index [default]
  async reload(mode, coordinatesList = null) {
    const recompute = mode === 'definitions'
    const baseList = coordinatesList || (await this.list(new EntityCoordinates(), recompute))
    const list = baseList.map(entry => EntityCoordinates.fromString(entry))
    return await Promise.all(
      list.map(
        throat(10, async coordinates => {
          const definition = await this.get(coordinates, null, recompute)
          if (recompute) return Promise.resolve(null)
          return this.search.store(definition)
        })
      )
    )
  }

  // ensure all the right facet information has been computed and added to the given definition
  _ensureFacets(definition) {
    if (!definition.files) return
    const facetFiles = this._computeFacetFiles([...definition.files], definition.described.facets)
    for (const facet in facetFiles)
      setIfValue(definition, `licensed.facets.${facet}`, this._summarizeFacetInfo(facet, facetFiles[facet]))
  }

  // figure out which files are in which facets
  _computeFacetFiles(files, facets = {}) {
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

  // create the data object for the identified facet containing the given files. Also destructively brand
  // the individual file objects with the facet
  _summarizeFacetInfo(facet, facetFiles) {
    if (!facetFiles || facetFiles.length === 0) return null
    const attributions = new Set()
    const licenseExpressions = new Set()
    let unknownParties = 0
    let unknownLicenses = 0
    // accummulate all the licenses and attributions, and count anything that's missing
    for (let file of facetFiles) {
      file.license ? licenseExpressions.add(file.license) : unknownLicenses++
      const statements = this._simplifyAttributions(file.attributions)
      statements ? addArrayToSet(statements, attributions) : unknownParties++
      if (facet !== 'core') {
        // tag the file with the current facet if not core
        file.facets = file.facets || []
        file.facets.push(facet)
      }
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
    setIfValue(result, 'attribution.parties', setToArray(attributions))
    setIfValue(result, 'discovered.expressions', setToArray(licenseExpressions))
    return result
  }

  _simplifyAttributions(attributions) {
    if (!attributions || !attributions.length) return null
    const set = attributions.reduce((result, attribution) => {
      result.add(
        he
          .decode(attribution)
          .replace(/(\\[nr]|[\n\r])/g, ' ')
          .replace(/ +/g, ' ')
          .trim()
      )
      return result
    }, new Set())
    return setToArray(set)
  }

  _ensureCoordinates(coordinates, definition) {
    definition.coordinates = EntityCoordinates.fromObject(coordinates)
  }

  _ensureDescribed(definition) {
    definition.described = definition.described || {}
  }

  _ensureCurationInfo(definition, curation) {
    if (!curation) return
    this._ensureDescribed(definition)
    const tools = (definition.described.tools = definition.described.tools || [])
    if (Object.getOwnPropertyNames(curation).length === 0) return
    const origin = get(curation, '_origin.sha')
    tools.push(`curation${origin ? '/' + origin : 'supplied'}`)
  }

  _ensureSourceLocation(coordinates, definition) {
    if (definition.described && definition.described.sourceLocation) return
    // For source components there may not be an explicit harvested source location (it is self-evident)
    // Make it explicit in the definition
    switch (coordinates.provider) {
      case 'github': {
        const location = {
          type: 'git',
          provider: 'github',
          url: `https://github.com/${coordinates.namespace}/${coordinates.name}`,
          revision: coordinates.revision
        }
        this._ensureDescribed(definition)
        definition.described.sourceLocation = location
        break
      }
      default:
        return
    }
  }

  _getDefinitionCoordinates(coordinates) {
    return Object.assign({}, coordinates, { tool: 'definition', toolVersion: 1 })
  }
}

module.exports = (harvest, summary, aggregator, curation, store, search) =>
  new DefinitionService(harvest, summary, aggregator, curation, store, search)
