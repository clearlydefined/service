// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const fs = require('fs')
const path = require('path')
const recursive = require('recursive-readdir')
const { promisify } = require('util')
const ResultCoordinates = require('../../lib/resultCoordinates')
// @ts-ignore - JSON schema has no type declarations
const schema = require('../../schemas/definition-1.0')
const { getLatestVersion } = require('../../lib/utils')
const logger = require('../logging/logger')

/**
 * @typedef {import('./abstractFileStore').FileStoreOptions} FileStoreOptions
 * @typedef {import('./abstractFileStore').FileStoreQuery} FileStoreQuery
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('../logging').Logger} Logger
 */

/**
 * Abstract base class for file-based storage implementations.
 * Provides common functionality for reading and writing JSON files to disk.
 */
class AbstractFileStore {
  /**
   * Creates a new AbstractFileStore instance
   *
   * @param {FileStoreOptions} [options] - Configuration options for the store
   */
  constructor(options) {
    /** @type {FileStoreOptions} */
    this.options = options || /** @type {FileStoreOptions} */ ({ location: '' })
    /** @type {Logger} */
    this.logger = this.options.logger || logger()
  }

  async initialize() {}

  /**
   * Visit all of the files associated with the given coordinates.
   *
   * @template T
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates.
   * @param {function(any): T | null} visitor - Function to apply to each file's parsed JSON content
   * @returns {Promise<T[]>} The collection of results returned by the visitor
   */
  async list(coordinates, visitor) {
    try {
      const paths = await recursive(this._toStoragePathFromCoordinates(coordinates), ['.DS_Store'])
      return (
        await Promise.all(
          paths.map(async path => {
            if (!this._isValidPath(path)) return null
            const data = await promisify(fs.readFile)(path)
            return data ? visitor(JSON.parse(data.toString())) : null
          })
        )
      ).filter(x => x)
    } catch (error) {
      // If there is just no entry, that's fine, there is no content.
      const nodeError = /** @type {NodeJS.ErrnoException} */ (error)
      if (nodeError.code === 'ENOENT') return []
      throw error
    }
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - The coordinates of the object to get
   * @returns {Promise<any>} The loaded object or null if not found
   */
  async get(coordinates) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    try {
      const result = await promisify(fs.readFile)(filePath)
      return JSON.parse(result.toString())
    } catch (error) {
      const nodeError = /** @type {NodeJS.ErrnoException} */ (error)
      this.logger.debug(`Error reading file at ${filePath}: ${nodeError.message}`)
      if (nodeError.code === 'ENOENT') return null
      throw error
    }
  }

  /**
   * Query and return the objects based on the query
   *
   * @param {FileStoreQuery} query - The filters and sorts for the request
   * @returns {Promise<any[]>} Array of matching definitions
   */
  async find(query) {
    const paths = await recursive(this.options.location, ['.DS_Store'])
    return (
      await Promise.all(
        paths.map(async path => {
          try {
            if (!this._isValidPath(path)) return null
            const data = await promisify(fs.readFile)(path)
            if (!data) return null
            const definition = JSON.parse(data.toString())
            return definition
          } catch (error) {
            // If there is just no entry, that's fine, there is no content.
            const nodeError = /** @type {NodeJS.ErrnoException} */ (error)
            if (nodeError.code === 'ENOENT') return null
            throw error
          }
        })
      )
    ).filter(definition => {
      if (!definition) return false
      if (query.type && definition.coordinates?.type !== query.type) return false
      if (query.provider && definition.coordinates?.provider !== query.provider) return false
      if (query.name && definition.coordinates?.name !== query.name) return false
      if (query.namespace && definition.coordinates?.namespace !== query.namespace) return false
      if (query.license && definition.licensed?.declared !== query.license) return false
      if (query.releasedAfter && definition.described?.releaseDate < query.releasedAfter) return false
      if (query.releasedBefore && definition.described?.releaseDate > query.releasedBefore) return false
      if (query.minLicensedScore && definition.licensed?.score?.total < query.minLicensedScore) return false
      if (query.maxLicensedScore && definition.licensed?.score?.total > query.maxLicensedScore) return false

      if (query.minDescribedScore && definition.described?.score?.total < query.minDescribedScore) return false
      if (query.maxDescribedScore && definition.described?.score?.total > query.maxDescribedScore) return false
      return true
    })
  }

  /**
   * Validates if a storage path represents valid coordinates
   *
   * @protected
   * @param {string} entry - The path to validate
   * @returns {boolean} True if the path represents valid coordinates
   */
  _isValidPath(entry) {
    return AbstractFileStore.isInterestingCoordinates(this._toResultCoordinatesFromStoragePath(entry))
  }

  /**
   * Converts coordinates to a storage path
   *
   * @protected
   * @param {EntityCoordinates} coordinates - The coordinates to convert
   * @returns {string} The storage path
   */
  _toStoragePathFromCoordinates(coordinates) {
    const result = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
    return path.join(this.options.location, result).replace(/\\/g, '/')
  }

  /**
   * Converts a storage path to ResultCoordinates
   *
   * @protected
   * @param {string} path - The storage path to convert
   * @returns {ResultCoordinates} The ResultCoordinates
   */
  _toResultCoordinatesFromStoragePath(path) {
    const trimmed = path.slice(this.options.location.length + 1)
    return AbstractFileStore.toResultCoordinatesFromStoragePath(trimmed)
  }

  // Static helper methods shared between path-based stores

  /**
   * Checks if coordinates represent an interesting/valid component type
   *
   * @param {ResultCoordinates} coordinates - The coordinates to check
   * @returns {boolean} True if the coordinates are interesting
   */
  static isInterestingCoordinates(coordinates) {
    return schema.definitions.type.enum.includes(coordinates.type)
  }

  /**
   * Converts a storage path to ResultCoordinates
   *
   * @param {string} path - The storage path to convert
   * @returns {ResultCoordinates} The ResultCoordinates
   */
  static toResultCoordinatesFromStoragePath(path) {
    const trimmed = AbstractFileStore.trimStoragePath(path)
    return ResultCoordinates.fromString(trimmed)
  }

  /**
   * Trims a storage path to extract coordinate components
   *
   * @param {string} path - The storage path to trim
   * @returns {string} The trimmed path string
   */
  static trimStoragePath(path) {
    const normalized = path.replace(/\\/g, '/').replace(/.json$/, '')
    const rawSegments = normalized.split('/')
    const segments = rawSegments[0] === '' ? rawSegments.slice(1) : rawSegments
    const name = segments.slice(0, 4)
    const revision = segments.slice(5, 6)
    const toolSpec = segments.slice(7, 9)
    return name.concat(revision, toolSpec).join('/')
  }

  /**
   * Converts coordinates to a storage path
   *
   * @param {EntityCoordinates | import('../../lib/resultCoordinates').ResultCoordinatesSpec} coordinates - The coordinates to convert
   * @returns {string} The storage path string
   */
  static toStoragePathFromCoordinates(coordinates) {
    const c = /** @type {import('../../lib/resultCoordinates').ResultCoordinatesSpec} */ (coordinates)
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

  /**
   * Gets the latest tool version paths from a list of paths
   *
   * @param {string[]} paths - Array of paths to process
   * @param {function(string): ResultCoordinates} [toResultCoordinates] - Optional function to convert paths to coordinates
   * @returns {Set<string>} Set of paths representing the latest tool versions
   */
  static getLatestToolPaths(paths, toResultCoordinates = path => this.toResultCoordinatesFromStoragePath(path)) {
    /** @type {Record<string, {toolVersion: string, path: string}>} */
    const entries = paths
      .map(path => {
        const { tool, toolVersion } = toResultCoordinates(path)
        return { tool, toolVersion, path }
      })
      .reduce((latest, { tool, toolVersion, path }) => {
        if (!tool || !toolVersion) return latest
        latest[tool] = latest[tool] || { toolVersion: '', path: '' }
        //if the version is greater than the current version, replace it
        if (!latest[tool].toolVersion || getLatestVersion([toolVersion, latest[tool].toolVersion]) === toolVersion) {
          latest[tool] = { toolVersion, path }
        }
        return latest
      }, /** @type {Record<string, {toolVersion: string, path: string}>} */ ({}))
    const latestPaths = Object.values(entries).map(entry => entry.path)
    return new Set(latestPaths)
  }
}

module.exports = AbstractFileStore
