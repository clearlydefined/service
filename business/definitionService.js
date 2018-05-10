// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Readable = require('stream').Readable
const throat = require('throat')
const { get, union, values } = require('lodash')
const EntityCoordinates = require('../lib/entityCoordinates')

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
    return this._cast(existing || this.computeAndStore(coordinates))
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
            if (!error.code === 'ENOENT') throw error
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
    const facets = await this._computeFacets(coordinates, raw, curation)
    const summarized = await this.summaryService.summarizeAll(coordinates, raw, facets || {})
    const aggregated = await this.aggregationService.process(coordinates, summarized)
    const definition = await this.curationService.apply(coordinates, curation, aggregated)
    this._ensureCurationInfo(definition, curation)
    this._ensureSourceLocation(coordinates, definition)
    this._ensureCoordinates(coordinates, definition)
    return definition
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
          // if we are recomputing then the index will automatically be updated so no need to store again
          if (recompute) return Promise.resolve(null)
          return this.search.store(entries)
        })
      )
    )
  }

  /**
   * Compute facets related to an entity and a curation of that entity. This is essentially a light
   * weight pre-compute so we know what groupings to use in the real summarization.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation
   * @param {*} raw - the set of raw tool ouptuts related to the idenified entity
   * @param {Definition)} [curation] - an actual curation object to apply.
   * @returns {Facets} The `facets` portion of the component's described definition
   */
  async _computeFacets(coordinates, raw, curation) {
    // TODO we might be able to a more effecient computation here since all we need are the facets
    // for example, some tool outputs just will never have facets to there is no point in summarizing them.
    const summarized = await this.summaryService.summarizeFacets(coordinates, raw)
    const aggregated = await this.aggregationService.process(coordinates, summarized)
    const definition = await this.curationService.apply(coordinates, curation, aggregated)
    return get(definition, 'described.facets')
  }

  _ensureCoordinates(coordinates, definition) {
    definition.coordinates = {
      type: coordinates.type,
      provider: coordinates.provider,
      namespace: coordinates.namespace,
      name: coordinates.name,
      revision: coordinates.revision
    }
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
