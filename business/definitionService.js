// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const throat = require('throat')
const {
  get,
  set,
  sortedUniq,
  omit,
  remove,
  pullAllWith,
  isEqual,
  uniqWith,
  flatten,
  intersection,
  intersectionWith,
  concat
} = require('lodash')
const EntityCoordinates = require('../lib/entityCoordinates')
const {
  setIfValue,
  setToArray,
  addArrayToSet,
  buildSourceUrl,
  isDeclaredLicense,
  simplifyAttributions,
  updateSourceLocation
} = require('../lib/utils')
const minimatch = require('minimatch')
const extend = require('extend')
const logger = require('../providers/logging/logger')
const validator = require('../schemas/validator')
const SPDX = require('@clearlydefined/spdx')
const parse = require('spdx-expression-parse')
const computeLock = require('../providers/caching/memory')({ defaultTtlSeconds: 60 * 5 /* 5 mins */ })

const currentSchema = '1.6.1'

const weights = { declared: 30, discovered: 25, consistency: 15, spdx: 15, texts: 15, date: 30, source: 70 }

class DefinitionService {
  constructor(harvestStore, harvestService, summary, aggregator, curation, store, search, cache) {
    this.harvestStore = harvestStore
    this.harvestService = harvestService
    this.summaryService = summary
    this.aggregationService = aggregator
    this.curationService = curation
    this.definitionStore = store
    this.search = search
    this.cache = cache
    this.logger = logger()
  }

  /**
   * Get the final representation of the specified definition and optionally apply the indicated
   * curation.
   *
   * @param {EntityCoordinates} coordinates - The entity for which we are looking for a curation
   * @param {(number | string | Summary)} [curationSpec] - A PR number (string or number) for a proposed
   * curation or an actual curation object.
   * @param {bool} force - whether or not to force re-computation of the requested definition
   * @param {string} expand - hints for parts to include/exclude; e.g. "-files"
   * @returns {Definition} The fully rendered definition
   */
  async get(coordinates, pr = null, force = false, expand = null) {
    if (pr) {
      const curation = this.curationService.get(coordinates, pr)
      return this.compute(coordinates, curation)
    }
    const existing = await this._cacheExistingAside(coordinates, force)
    let result
    if (get(existing, '_meta.schemaVersion') === currentSchema) {
      this.logger.info('computed definition available', { coordinates: coordinates.toString() })
      result = existing
    } else result = force ? await this.computeAndStore(coordinates) : await this.computeStoreAndCurate(coordinates)
    return this._trimDefinition(this._cast(result), expand)
  }

  /**
   * Get directly from cache or store without any side effect, like compute
   * @param {} coordinates
   * @returns { Definition } The definition in store.
   */
  async getStored(coordinates) {
    const cacheKey = this._getCacheKey(coordinates)
    this.logger.info('1:Redis:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached
    this.logger.info('2:blob+mongoDB:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    const stored = await this.definitionStore.get(coordinates)
    if (stored) this._setDefinitionInCache(cacheKey, stored)
    return stored
  }

  async _cacheExistingAside(coordinates, force) {
    if (force) return null
    return await this.getStored(coordinates)
  }

  async _setDefinitionInCache(cacheKey, itemToStore) {
    // 1000 is a magic number here -- we don't want to cache very large definitions, as it can impact redis ops
    if (itemToStore.files && itemToStore.files.length > 1000) {
      this.logger.info('Skipping caching for key', { coordinates: itemToStore.coordinates.toString() })
      return
    }

    // TTL for two days, in seconds
    await this.cache.set(cacheKey, itemToStore, 60 * 60 * 24 * 2)
  }

  _trimDefinition(definition, expand) {
    if (expand === '-files') return omit(definition, 'files')
    return definition
  }

  // ensure the definition is a properly classed object
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
   * @returns A list of all components that have definitions and the definitions that are available
   */
  async getAll(coordinatesList, force = false, expand = null) {
    const result = {}
    const promises = coordinatesList.map(
      throat(10, async coordinates => {
        this.logger.info(`1:1:notice_generate:get_single_start:${coordinates}`, { ts: new Date().toISOString() })
        const definition = await this.get(coordinates, null, force, expand)
        this.logger.info(`1:1:notice_generate:get_single_end:${coordinates}`, { ts: new Date().toISOString() })
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
   * @param {EntityCoordinates[]} coordinatesList
   * @returns {Object[]} A list of all components that have definitions that are available
   */
  async listAll(coordinatesList) {
    //Take the array of coordinates, strip out the revision and only return uniques
    const searchCoordinates = uniqWith(coordinatesList.map(coordinates => coordinates.asRevisionless()), isEqual)
    const promises = searchCoordinates.map(
      throat(10, async coordinates => {
        try {
          return await this.list(coordinates)
        } catch (error) {
          return null
        }
      })
    )
    const foundDefinitions = flatten(await Promise.all(concat(promises)))
    // Filter only the revisions matching the found definitions
    return intersectionWith(
      coordinatesList,
      foundDefinitions,
      (a, b) => a && b && a.toString().toLowerCase() === b.toString().toLowerCase()
    )
  }

  /**
   * Get the definitions that exist in the store matching the given query
   * @param {object} query
   * @returns The data and continuationToken if there is more results
   */
  find(query) {
    return this.definitionStore.find(query, query.continuationToken)
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
          await this.definitionStore.delete(coordinates)
          await this.cache.delete(this._getCacheKey(coordinates))
        })
      )
    )
  }

  _validate(definition) {
    if (!validator.validate('definition', definition)) throw new Error(validator.errorsText())
  }

  async computeStoreAndCurate(coordinates) {
    // one coordinate a time through this method so no duplicate auto curation will be created.
    this.logger.info('3:memory_lock:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    while (computeLock.get(coordinates.toString())) await new Promise(resolve => setTimeout(resolve, 500))
    try {
      computeLock.set(coordinates.toString(), true)
      const definition = await this._computeAndStore(coordinates)
      await this.curationService.autoCurate(definition)
      return definition
    } finally {
      computeLock.delete(coordinates.toString())
    }
  }

  async computeAndStore(coordinates) {
    while (computeLock.get(coordinates.toString())) await new Promise(resolve => setTimeout(resolve, 500)) // one coordinate a time through this method so we always get latest
    try {
      computeLock.set(coordinates.toString(), true)
      return await this._computeAndStore(coordinates)
    } finally {
      computeLock.delete(coordinates.toString())
    }
  }

  async _computeAndStore(coordinates) {
    const definition = await this.compute(coordinates)
    // If no tools participated in the creation of the definition then don't bother storing.
    // Note that curation is a tool so no tools really means there the definition is effectively empty.
    const tools = get(definition, 'described.tools')
    if (!tools || tools.length === 0) {
      this.logger.info('definition not available', { coordinates: coordinates.toString() })
      this._harvest(coordinates) // fire and forget
      return definition
    }
    this.logger.info('recomputed definition available', { coordinates: coordinates.toString() })
    await this._store(definition)
    return definition
  }

  async _harvest(coordinates) {
    try {
      this.logger.info('trigger_harvest:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
      await this.harvestService.harvest({ tool: 'component', coordinates }, true)
      this.logger.info('trigger_harvest:end', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    } catch (error) {
      this.logger.info('failed to harvest from definition service', {
        crawlerError: error,
        coordinates: coordinates.toString()
      })
    }
  }

  async _store(definition) {
    await this.definitionStore.store(definition)
    await this._setDefinitionInCache(this._getCacheKey(definition.coordinates), definition)
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
    this.logger.info('4:compute:blob:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    const raw = await this.harvestStore.getAll(coordinates)
    this.logger.info('4:compute:blob:end', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    coordinates = this._getCasedCoordinates(raw, coordinates)
    this.logger.info('5:compute:summarize:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    const summaries = await this.summaryService.summarizeAll(coordinates, raw)
    this.logger.info('6:compute:aggregate:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    const aggregatedDefinition = (await this.aggregationService.process(summaries, coordinates)) || {}
    this.logger.info('6:compute:aggregate:end', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    aggregatedDefinition.coordinates = coordinates
    this._ensureToolScores(coordinates, aggregatedDefinition)
    const definition = await this.curationService.apply(coordinates, curationSpec, aggregatedDefinition)
    this.logger.info('9:compute:calculate:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
    this._finalizeDefinition(coordinates, definition)
    this._ensureCuratedScores(definition)
    this._ensureFinalScores(definition)
    // protect against any element of the compute producing an invalid definition
    this._ensureNoNulls(definition)
    this._validate(definition)
    this.logger.info('9:compute:calculate:end', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
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

  _ensureFinalScores(definition) {
    const { described, licensed } = definition
    set(definition, 'scores.effective', Math.floor((described.score.total + licensed.score.total) / 2))
    set(definition, 'scores.tool', Math.floor((described.toolScore.total + licensed.toolScore.total) / 2))
  }

  _finalizeDefinition(coordinates, definition) {
    this._ensureFacets(definition)
    this._ensureSourceLocation(coordinates, definition)
    set(definition, '_meta.schemaVersion', currentSchema)
    set(definition, '_meta.updated', new Date().toISOString())
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
    const date = get(definition, 'described.releaseDate') ? weights.date : 0
    const source = get(definition, 'described.sourceLocation.url') ? weights.source : 0
    const total = date + source
    return { total, date, source }
  }

  // Given a definition, calculate and return the score for the licensed dimension
  _computeLicensedScore(definition) {
    const declared = this._computeDeclaredScore(definition)
    const discovered = this._computeDiscoveredScore(definition)
    const consistency = this._computeConsistencyScore(definition)
    const spdx = this._computeSPDXScore(definition)
    const texts = this._computeTextsScore(definition)
    const total = declared + discovered + consistency + spdx + texts
    return { total, declared, discovered, consistency, spdx, texts }
  }

  _computeDeclaredScore(definition) {
    const declared = get(definition, 'licensed.declared')
    return isDeclaredLicense(declared) ? weights.declared : 0
  }

  _computeDiscoveredScore(definition) {
    if (!definition.files) return 0
    const coreFiles = definition.files.filter(DefinitionService._isInCoreFacet)
    if (!coreFiles.length) return 0
    const completeFiles = coreFiles.filter(file => file.license && (file.attributions && file.attributions.length))
    return Math.round((completeFiles.length / coreFiles.length) * weights.discovered)
  }

  _computeConsistencyScore(definition) {
    const declared = get(definition, 'licensed.declared')
    // Note here that we are saying that every discovered license is satisfied by the declared
    // license. If there are no discovered licenses then all is good.
    const discovered = get(definition, 'licensed.facets.core.discovered.expressions') || []
    if (!declared || !discovered) return 0
    return discovered.every(expression => SPDX.satisfies(expression, declared)) ? weights.consistency : 0
  }

  _computeSPDXScore(definition) {
    try {
      parse(get(definition, 'licensed.declared')) // use strict spdx-expression-parse
      return weights.spdx
    } catch (e) {
      return 0
    }
  }

  _computeTextsScore(definition) {
    if (!definition.files || !definition.files.length) return 0
    const includedTexts = this._collectLicenseTexts(definition)
    if (!includedTexts.length) return 0
    const referencedLicenses = this._collectReferencedLicenses(definition)
    if (!referencedLicenses.length) return 0

    // check that all the referenced licenses have texts
    const found = intersection(referencedLicenses, includedTexts)
    return found.length === referencedLicenses.length ? weights.texts : 0
  }

  // get all the licenses that have been referenced anywhere in the definition (declared and core)
  _collectReferencedLicenses(definition) {
    const referencedExpressions = new Set(get(definition, 'licensed.facets.core.discovered.expressions') || [])
    const declared = get(definition, 'licensed.declared')
    if (declared) referencedExpressions.add(declared)
    const result = new Set()
    referencedExpressions.forEach(expression => this._extractLicensesFromExpression(expression, result))
    return Array.from(result)
  }

  // Get the full set of license texts captured in the definition
  _collectLicenseTexts(definition) {
    const result = new Set()
    definition.files
      .filter(DefinitionService._isLicenseFile)
      .forEach(file => this._extractLicensesFromExpression(file.license, result))
    return Array.from(result)
  }

  // recursively add all licenses mentioned in the given expression to the given set
  _extractLicensesFromExpression(expression, seen) {
    if (!expression) return null
    if (typeof expression === 'string') expression = SPDX.parse(expression)
    if (expression.license) return seen.add(expression.license)
    this._extractLicensesFromExpression(expression.left, seen)
    this._extractLicensesFromExpression(expression.right, seen)
  }

  static _isInCoreFacet(file) {
    return !file.facets || file.facets.includes('core')
  }

  // Answer whether or not the given file is a license text file
  static _isLicenseFile(file) {
    return file.token && DefinitionService._isInCoreFacet(file) && (file.natures || []).includes('license')
  }

  /**
   * Suggest a set of definition coordinates that match the given pattern. Only existing definitions are searched.
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
            if (this.search.store) return this.search.store(definition)
          } catch (error) {
            this.logger.info('failed to reload in definition service', {
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
    // accumulate all the licenses and attributions, and count anything that's missing
    for (let file of facetFiles) {
      file.license ? licenseExpressions.add(file.license) : unknownLicenses++
      const statements = simplifyAttributions(file.attributions)
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
    setIfValue(result, 'attribution.parties', simplifyAttributions(setToArray(attributions)))
    // TODO need a function to reduce/simplify sets of expressions
    setIfValue(result, 'discovered.expressions', setToArray(licenseExpressions))
    return result
  }

  _ensureDescribed(definition) {
    definition.described = definition.described || {}
  }

  _ensureSourceLocation(coordinates, definition) {
    if (get(definition, 'described.sourceLocation')) return updateSourceLocation(definition.described.sourceLocation)
    // For source components there may not be an explicit harvested source location (it is self-evident)
    // Make it explicit in the definition
    switch (coordinates.provider) {
      case 'golang':
      case 'gitlab':
      case 'github':
      case 'pypi': {
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

  _getCacheKey(coordinates) {
    return `def_${EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()}`
  }
}

module.exports = (harvestStore, harvestService, summary, aggregator, curation, store, search, cache) =>
  new DefinitionService(harvestStore, harvestService, summary, aggregator, curation, store, search, cache)
