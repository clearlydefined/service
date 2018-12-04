// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const throat = require('throat')
const { get, set, sortedUniq, remove, pullAllWith, isEqual, uniqBy, flatten } = require('lodash')
const EntityCoordinates = require('../lib/entityCoordinates')
const { setIfValue, setToArray, addArrayToSet, buildSourceUrl, updateSourceLocation } = require('../lib/utils')
const minimatch = require('minimatch')
const he = require('he')
const extend = require('extend')
const logger = require('../providers/logging/logger')()
const validator = require('../schemas/validator')

const currentSchema = '1.0.0'

class DefinitionService {
  constructor(harvestStore, harvestService, summary, aggregator, curation, store, search) {
    this.harvestStore = harvestStore
    this.harvestService = harvestService
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
    const existing = force ? null : await this.definitionStore.get(coordinates)
    const result = get(existing, 'schemaVersion') === currentSchema ? existing : await this.computeAndStore(coordinates)
    return this._cast(result)
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
    if (!recompute) return this.definitionStore.list(coordinates)
    const curated = (await this.curationService.list(coordinates)).map(c => c.toString())
    const tools = await this.harvestStore.list(coordinates)
    const harvest = tools.map(tool => EntityCoordinates.fromString(tool).toString())
    return sortedUniq([...harvest, ...curated])
  }

  /**
   * Get a list of all the definitions that exist in the store matching the given coordinates
   * @param {Object[]} coordinatesList
   * @returns {Object[]} A list of all components that have definitions that are available
   */
  async listAll(coordinatesList) {
    //Take the array of coordinates, strip out the revision and only return uniques
    const coordinatesWithoutRevision = uniqBy(
      coordinatesList.map(coordinates => {
        const { revision, ...withoutRevision } = coordinates
        return withoutRevision
      }),
      isEqual
    )
    const promises = coordinatesWithoutRevision.map(async coordinates => {
      try {
        return await this.list(coordinates)
      } catch (error) {
        console.log(error)
      }
    })
    const foundDefinitions = flatten(await Promise.all(promises))
    // Filter only the revisions matching the found definitions
    return coordinatesList.filter(coordinates => {
      return (
        foundDefinitions.findIndex(definition => definition === EntityCoordinates.fromObject(coordinates).toString()) >
        -1
      )
    })
  }

  /**
   * Invalidate the definition for the identified component. This flushes any caches and pre-computed
   * results. The definition will be recomputed on or before the next use.
   *
   * @param {Coordinates} coordinates - individual or array of coordinates to invalidate
   */
  invalidate(coordinates) {
    const coordinateList = Array.isArray(coordinates) ? coordinates : [coordinates]
    return Promise.all(coordinateList.map(throat(10, coordinates => this.definitionStore.delete(coordinates))))
  }

  _validate(definition) {
    if (!validator.validate('definition', definition)) throw new Error(validator.errorsText())
  }

  async computeAndStore(coordinates) {
    const definition = await this.compute(coordinates)
    // If no tools participated in the creation of the definition then don't bother storing.
    // Note that curation is a tool so no tools really means there the definition is effectively empty.
    const tools = get(definition, 'described.tools')
    if (!tools || tools.length === 0) {
      this.harvest(coordinates)
      return definition
    }
    await this._store(definition)
    return definition
  }

  async harvest(coordinates) {
    try {
      await this.harvestService.harvest({ tool: 'component', coordinates })
    } catch (error) {
      logger.info('failed to harvest from definition service', {
        crawlerError: error,
        coordinates: coordinates.toString()
      })
    }
  }

  async _store(definition) {
    await this.definitionStore.store(definition)
    return this.search.store(definition)
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
    const raw = await this.harvestStore.getAll(coordinates)
    coordinates = this._getCasedCoordinates(raw, coordinates)
    const summaries = await this.summaryService.summarizeAll(coordinates, raw)
    const aggregatedDefinition = (await this.aggregationService.process(summaries)) || {}
    aggregatedDefinition.coordinates = coordinates
    this._ensureToolScores(coordinates, aggregatedDefinition)
    const definition = await this.curationService.apply(coordinates, curationSpec, aggregatedDefinition)
    this._finalizeDefinition(coordinates, definition)
    this._ensureCuratedScores(definition)
    // protect against any element of the compute producing an invalid defintion
    this._ensureNoNulls(definition)
    this._validate(definition)
    return definition
  }

  _getCasedCoordinates(raw, coordinates) {
    if (!raw || !Object.keys(raw).length) return coordinates
    for (const tool in raw) {
      for (const version in raw[tool]) {
        const cased = get(raw[tool][version], '_metadata.links.self.href')
        if (cased) return EntityCoordinates.fromUrn(cased)
      }
    }
    throw new Error('unable to find self link')
  }

  // Ensure that the given object (e.g., a definition) does not have any null properties.
  _ensureNoNulls(object) {
    Object.keys(object).forEach(key => {
      if (object[key] && typeof object[key] === 'object') this._ensureNoNulls(object[key])
      else if (object[key] == null) delete object[key]
    })
  }

  // Compute and store the scored for the given definition but do it in a way that does not affect the
  // definition so that further curations can be done.
  _ensureToolScores(coordinates, definition) {
    const rawDefinition = extend(true, {}, definition)
    this._finalizeDefinition(coordinates, rawDefinition)
    const { describedScore, licensedScore } = this._computeScores(rawDefinition)
    set(definition, 'described.toolScore', describedScore)
    set(definition, 'licensed.toolScore', licensedScore)
  }

  _ensureCuratedScores(definition) {
    const { describedScore, licensedScore } = this._computeScores(definition)
    set(definition, 'described.score', describedScore)
    set(definition, 'licensed.score', licensedScore)
  }

  _finalizeDefinition(coordinates, definition) {
    this._ensureFacets(definition)
    this._ensureSourceLocation(coordinates, definition)
    definition.schemaVersion = currentSchema
  }

  // Given a definition, calculate the scores for the definition and return an object with a score per dimension
  _computeScores(definition) {
    return {
      licensedScore: this._computeLicensedScore(definition),
      describedScore: this._computeDescribedScore(definition)
    }
  }

  // Given a definition, calculate and return the score for the described dimension
  _computeDescribedScore(definition) {
    // @todo we need to flesh this out
    // For now it just checks that a few props are present
    let result = 0
    result += !!get(definition, 'described.releaseDate')
    result += !!get(definition, 'described.sourceLocation.url')
    // TODO add in validated
    return result
  }

  // Given a definition, calculate and return the score for the licensed dimension
  _computeLicensedScore(definition) {
    // @todo we need to flesh this out
    // For now it just checks that a license and copyright holders are present
    let result = 0
    result += !!get(definition, 'licensed.declared')
    result += !!get(definition, 'licensed.facets.core.attribution.parties[0]')
    return result
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
          try {
            const definition = await this.get(coordinates, null, recompute)
            if (recompute) return Promise.resolve(null)
            return this.search.store(definition)
          } catch (error) {
            logger.info('failed to reload in definition service', {
              error,
              coordinates: coordinates.toString()
            })
          }
        })
      )
    )
  }

  // ensure all the right facet information has been computed and added to the given definition
  _ensureFacets(definition) {
    if (!definition.files) return
    const facetFiles = this._computeFacetFiles([...definition.files], get(definition, 'described.facets'))
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
      setIfValue(file, 'attributions', statements)
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

  _ensureDescribed(definition) {
    definition.described = definition.described || {}
  }

  _ensureSourceLocation(coordinates, definition) {
    if (get(definition, 'described.sourceLocation')) return updateSourceLocation(definition.described.sourceLocation)
    // For source components there may not be an explicit harvested source location (it is self-evident)
    // Make it explicit in the definition
    switch (coordinates.provider) {
      case 'github': {
        const url = buildSourceUrl(coordinates)
        if (!url) return
        this._ensureDescribed(definition)
        definition.described.sourceLocation = { ...coordinates, url }
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

module.exports = (harvestStore, harvestService, summary, aggregator, curation, store, search) =>
  new DefinitionService(harvestStore, harvestService, summary, aggregator, curation, store, search)
