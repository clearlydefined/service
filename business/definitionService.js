// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Readable = require('stream').Readable
const throat = require('throat')
const { get } = require('lodash')

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
    if (force) await this.invalidate(coordinates)
    try {
      const definitionCoordinates = this._getDefinitionCoordinates(coordinates)
      return await this.definitionStore.get(definitionCoordinates)
    } catch (error) {
      // cache miss
      return this.computeAndStore(coordinates)
    }
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
        const summary = await this.get(coordinates, null, force)
        const key = coordinates.asEntityCoordinates().toString()
        result[key] = summary
      })
    )
    await Promise.all(promises)
    return result
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
    await this.search.store(coordinates, definition)
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
