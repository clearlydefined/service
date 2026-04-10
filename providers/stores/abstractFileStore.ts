// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { promisify } from 'node:util'
import recursive from 'recursive-readdir'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { ResultCoordinatesSpec } from '../../lib/resultCoordinates.ts'
import ResultCoordinates from '../../lib/resultCoordinates.ts'
import type { Logger } from '../logging/index.js'

const require = createRequire(import.meta.url)
const schema = require('../../schemas/definition-1.0.json')

import { getLatestVersion } from '../../lib/utils.ts'
import logger from '../logging/logger.ts'

/** Options for configuring an AbstractFileStore */
export interface FileStoreOptions {
  /** Base directory location for file storage */
  location: string
  /** Optional logger instance */
  logger?: Logger
}

/** Query parameters for finding definitions */
export interface FileStoreQuery {
  /** Filter by component type */
  type?: string
  /** Filter by provider */
  provider?: string
  /** Filter by namespace */
  namespace?: string
  /** Filter by name */
  name?: string
  /** Filter by declared license */
  license?: string
  /** Filter by release date (after) */
  releasedAfter?: string
  /** Filter by release date (before) */
  releasedBefore?: string
  /** Filter by minimum licensed score */
  minLicensedScore?: number
  /** Filter by maximum licensed score */
  maxLicensedScore?: number
  /** Filter by minimum described score */
  minDescribedScore?: number
  /** Filter by maximum described score */
  maxDescribedScore?: number
}

/** Visitor function type for list operations */
export type FileStoreVisitor<T> = (data: any) => T | null

/**
 * Abstract base class for file-based storage implementations.
 * Provides common functionality for reading and writing JSON files to disk.
 */
class AbstractFileStore {
  options: FileStoreOptions
  logger: Logger

  constructor(options?: FileStoreOptions) {
    this.options = options || ({ location: '' } as FileStoreOptions)
    this.logger = this.options.logger || logger()
  }

  async initialize(): Promise<void> {}

  /**
   * Visit all of the files associated with the given coordinates.
   */
  async list<T>(coordinates: EntityCoordinates | ResultCoordinates, visitor: FileStoreVisitor<T>): Promise<T[]> {
    try {
      const paths = await recursive(this._toStoragePathFromCoordinates(coordinates), ['.DS_Store'])
      return (
        await Promise.all(
          paths.map(async path => {
            if (!this._isValidPath(path)) {
              return null
            }
            const data = await promisify(fs.readFile)(path)
            return data ? visitor(JSON.parse(data.toString())) : null
          })
        )
      ).filter(x => x)
    } catch (error) {
      // If there is just no entry, that's fine, there is no content.
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Get and return the object at the given coordinates.
   */
  async get(coordinates: EntityCoordinates | ResultCoordinates): Promise<any> {
    const filePath = `${this._toStoragePathFromCoordinates(coordinates)}.json`
    try {
      const result = await promisify(fs.readFile)(filePath)
      return JSON.parse(result.toString())
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      this.logger.debug(`Error reading file at ${filePath}: ${nodeError.message}`)
      if (nodeError.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * Query and return the objects based on the query
   */
  async find(query: FileStoreQuery): Promise<any[]> {
    const paths = await recursive(this.options.location, ['.DS_Store'])
    return (
      await Promise.all(
        paths.map(async path => {
          try {
            if (!this._isValidPath(path)) {
              return null
            }
            const data = await promisify(fs.readFile)(path)
            if (!data) {
              return null
            }
            const definition = JSON.parse(data.toString())
            return definition
          } catch (error) {
            // If there is just no entry, that's fine, there is no content.
            const nodeError = error as NodeJS.ErrnoException
            if (nodeError.code === 'ENOENT') {
              return null
            }
            throw error
          }
        })
      )
    ).filter(definition => {
      if (!definition) {
        return false
      }
      if (query.type && definition.coordinates?.type !== query.type) {
        return false
      }
      if (query.provider && definition.coordinates?.provider !== query.provider) {
        return false
      }
      if (query.name && definition.coordinates?.name !== query.name) {
        return false
      }
      if (query.namespace && definition.coordinates?.namespace !== query.namespace) {
        return false
      }
      if (query.license && definition.licensed?.declared !== query.license) {
        return false
      }
      if (query.releasedAfter && definition.described?.releaseDate < query.releasedAfter) {
        return false
      }
      if (query.releasedBefore && definition.described?.releaseDate > query.releasedBefore) {
        return false
      }
      if (query.minLicensedScore && definition.licensed?.score?.total < query.minLicensedScore) {
        return false
      }
      if (query.maxLicensedScore && definition.licensed?.score?.total > query.maxLicensedScore) {
        return false
      }

      if (query.minDescribedScore && definition.described?.score?.total < query.minDescribedScore) {
        return false
      }
      if (query.maxDescribedScore && definition.described?.score?.total > query.maxDescribedScore) {
        return false
      }
      return true
    })
  }

  _isValidPath(entry: string): boolean {
    return AbstractFileStore.isInterestingCoordinates(this._toResultCoordinatesFromStoragePath(entry))
  }

  _toStoragePathFromCoordinates(coordinates: EntityCoordinates | ResultCoordinates): string {
    const result = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
    return path.join(this.options.location, result).replace(/\\/g, '/')
  }

  _toResultCoordinatesFromStoragePath(path: string): ResultCoordinates {
    const trimmed = path.slice(this.options.location.length + 1)
    return AbstractFileStore.toResultCoordinatesFromStoragePath(trimmed)
  }

  // Static helper methods shared between path-based stores

  static isInterestingCoordinates(coordinates: ResultCoordinates): boolean {
    return schema.definitions.type.enum.includes(coordinates.type)
  }

  static toResultCoordinatesFromStoragePath(path: string): ResultCoordinates {
    const trimmed = AbstractFileStore.trimStoragePath(path)
    return ResultCoordinates.fromString(trimmed)
  }

  static trimStoragePath(path: string): string {
    const normalized = path.replace(/\\/g, '/').replace(/.json$/, '')
    const rawSegments = normalized.split('/')
    const segments = rawSegments[0] === '' ? rawSegments.slice(1) : rawSegments
    const name = segments.slice(0, 4)
    const revision = segments.slice(5, 6)
    const toolSpec = segments.slice(7, 9)
    return name.concat(revision, toolSpec).join('/')
  }

  static toStoragePathFromCoordinates(
    coordinates: EntityCoordinates | ResultCoordinates | ResultCoordinatesSpec
  ): string {
    const c = coordinates as ResultCoordinatesSpec
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

  static getLatestToolPaths(
    paths: string[],
    toResultCoordinates: (path: string) => ResultCoordinates = path =>
      AbstractFileStore.toResultCoordinatesFromStoragePath(path)
  ): Set<string> {
    const entries: Record<string, { toolVersion: string; path: string }> = paths
      .map(path => {
        const { tool, toolVersion } = toResultCoordinates(path)
        return { tool, toolVersion, path }
      })
      .reduce(
        (latest, { tool, toolVersion, path }) => {
          if (!tool || !toolVersion) {
            return latest
          }
          latest[tool] = latest[tool] || { toolVersion: '', path: '' }
          //if the version is greater than the current version, replace it
          if (!latest[tool].toolVersion || getLatestVersion([toolVersion, latest[tool].toolVersion]) === toolVersion) {
            latest[tool] = { toolVersion, path }
          }
          return latest
        },
        {} as Record<string, { toolVersion: string; path: string }>
      )
    const latestPaths = Object.values(entries).map(entry => entry.path)
    return new Set(latestPaths)
  }
}

export default AbstractFileStore
