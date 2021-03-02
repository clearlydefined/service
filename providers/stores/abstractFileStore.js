// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const fs = require('fs')
const path = require('path')
const recursive = require('recursive-readdir')
const { promisify } = require('util')
const ResultCoordinates = require('../../lib/resultCoordinates')
const schema = require('../../schemas/definition-1.0')

class AbstractFileStore {
  constructor(options) {
    this.options = options
  }

  async initialize() { }

  /**
   * Visit all of the files associated with the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates.
   * @returns The collection of results returned by the visitor
   */
  async list(coordinates, visitor) {
    try {
      const paths = await recursive(this._toStoragePathFromCoordinates(coordinates), ['.DS_Store'])
      return (await Promise.all(
        paths.map(async path => {
          if (!this._isValidPath(path)) return null
          const data = await promisify(fs.readFile)(path)
          return data ? visitor(JSON.parse(data)) : null
        })
      )).filter(x => x)
    } catch (error) {
      // If there is just no entry, that's fine, there is no content.
      if (error.code === 'ENOENT') return []
      throw error
    }
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {Coordinates} coordinates - The coordinates of the object to get
   * @returns The loaded object
   */
  async get(coordinates) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    try {
      const result = await promisify(fs.readFile)(filePath)
      return JSON.parse(result)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  /**
   * Query and return the objects based on the query
   *
   * @param {object} query - The filters and sorts for the request
   * @returns The data and continuationToken if there is more results
   */
  async find(query) {
    const paths = await recursive(this.options.location, ['.DS_Store'])
    return (await Promise.all(
      paths.map(async path => {
        try {
          if (!this._isValidPath(path)) return null
          const data = await promisify(fs.readFile)(path)
          if (!data) return null
          const definition = JSON.parse(data)
          return definition
        } catch (error) {
          // If there is just no entry, that's fine, there is no content.
          if (error.code === 'ENOENT') return null
          throw error
        }
      })
    )).filter(definition => {
      if (!definition) return false
      if (query.type && definition.coordinates.type !== query.type) return false
      if (query.provider && definition.coordinates.provider !== query.provider) return false
      if (query.name && definition.coordinates.name !== query.name) return false
      if (query.namespace && definition.coordinates.namespace !== query.namespace) return false
      if (query.license && definition.licensed.declared !== query.license) return false
      if (query.releasedAfter && definition.described.releaseDate < query.releasedAfter) return false
      if (query.releasedBefore && definition.described.releaseDate > query.releasedBefore) return false
      if (query.minLicensedScore && definition.licensed.score.total < query.minLicensedScore) return false
      if (query.maxLicensedScore && definition.licensed.score.total > query.maxLicensedScore) return false
      if (query.minDescribedScore && definition.described.score.total < query.minDescribedScore) return false
      if (query.maxDescribedScore && definition.described.score.total > query.maxDescribedScore) return false
      return true
    })
  }

  _isValidPath(entry) {
    return AbstractFileStore.isInterestingCoordinates(this._toResultCoordinatesFromStoragePath(entry))
  }

  _toStoragePathFromCoordinates(coordinates) {
    const result = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
    return path.join(this.options.location, result).replace(/\\/g, '/')
  }

  _toResultCoordinatesFromStoragePath(path) {
    const trimmed = path.slice(this.options.location.length + 1)
    return AbstractFileStore.toResultCoordinatesFromStoragePath(trimmed)
  }

  // Static helper methods shared between path-based stores

  static isInterestingCoordinates(coordinates) {
    return schema.definitions.type.enum.includes(coordinates.type)
  }

  static toResultCoordinatesFromStoragePath(path) {
    const trimmed = AbstractFileStore.trimStoragePath(path)
    return ResultCoordinates.fromString(trimmed)
  }

  static trimStoragePath(path) {
    const normalized = path.replace(/\\/g, '/').replace(/.json$/, '')
    const rawSegments = normalized.split('/')
    const segments = rawSegments[0] === '' ? rawSegments.slice(1) : rawSegments
    const name = segments.slice(0, 4)
    const revision = segments.slice(5, 6)
    const toolSpec = segments.slice(7, 9)
    return name.concat(revision, toolSpec).join('/')
  }

  static toStoragePathFromCoordinates(coordinates) {
    const c = coordinates
    const revisionPart = c.revision ? `revision/${c.revision}` : null
    const toolVersionPart = c.toolVersion ? c.toolVersion : null
    const toolPart = c.tool ? `tool/${c.tool}` : null
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = c.provider ? c.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [c.type, c.provider, namespace, c.name, revisionPart, toolPart, toolVersionPart]
      .filter(s => s)
      .join('/')
      .toLowerCase()
  }
}

module.exports = AbstractFileStore
