// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import fs from 'node:fs'
import type { Writable } from 'node:stream'
import lodash from 'lodash'
import recursive from 'recursive-readdir'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { ResultCoordinates } from '../../lib/resultCoordinates.ts'
import ResultCoordinatesClass from '../../lib/resultCoordinates.ts'
import type { FileStoreOptions } from './abstractFileStore.ts'
import AbstractFileStore from './abstractFileStore.ts'

const { sortedUniq, get } = lodash

/** Tool output results organized by tool name and version */
export interface ToolOutputs {
  [toolName: string]: {
    [toolVersion: string]: any
  }
}

/**
 * File system implementation for storing harvest results.
 * Extends AbstractFileStore with harvest-specific functionality.
 */
export class FileHarvestStore extends AbstractFileStore {
  /**
   * List all of the results for the given coordinates.
   */
  // @ts-expect-error - Simplified list signature (visitor is handled internally)
  override async list(coordinates: EntityCoordinates | ResultCoordinates): Promise<string[]> {
    const list = await super.list(coordinates, (entry: any) => {
      const link = get(entry, '_metadata.links.self.href')
      if (!link) {
        return null
      }
      return ResultCoordinatesClass.fromUrn(link).toString()
    })
    return sortedUniq(list.filter(x => x))
  }

  /**
   * Stream the content identified by the coordinates onto the given stream and close the stream.
   */
  async stream(coordinates: ResultCoordinates, stream: Writable): Promise<null> {
    const filePath = `${this._toStoragePathFromCoordinates(coordinates)}.json`
    return new Promise((resolve, reject) => {
      const read = fs.createReadStream(filePath)
      read.on('end', () => resolve(null))
      read.on('error', error => reject(error))
      read.pipe(stream)
    })
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision.
   */
  async getAll(coordinates: EntityCoordinates): Promise<ToolOutputs> {
    // TODO validate/enforce that the coordinates are down to the component revision
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const allFilesList = await this._getListOfAllFiles(coordinates)
    return await this._getContent(allFilesList)
  }

  async _getListOfAllFiles(coordinates: EntityCoordinates): Promise<string[]> {
    const root = this._toStoragePathFromCoordinates(coordinates)
    try {
      return await recursive(root, ['.DS_Store'])
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  async _getContent(files: string[]): Promise<ToolOutputs> {
    const contents = await Promise.all(
      files.map(file => {
        return new Promise<{ name: string; content: any }>((resolve, reject) =>
          fs.readFile(file, (error, data) =>
            error ? reject(error) : resolve({ name: file, content: JSON.parse(data.toString()) })
          )
        )
      })
    )
    return contents.reduce<ToolOutputs>((result, entry) => {
      const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name)
      result[tool] = result[tool] || {}
      const current = result[tool]
      current[toolVersion] = entry.content
      return result
    }, {} as ToolOutputs)
  }

  /**
   * Get the latest version of each tool output for the given coordinates. The coordinates must be all the way down
   * to a revision.
   */
  async getAllLatest(coordinates: EntityCoordinates): Promise<ToolOutputs> {
    const allFilesList = await this._getListOfAllFiles(coordinates)
    const latestFilesList = this._getListOfLatestFiles(allFilesList)
    return await this._getContent(latestFilesList)
  }

  _getListOfLatestFiles(allFiles: string[]): string[] {
    let latestFiles: string[] = []
    try {
      const latest = this._getLatestToolVersions(allFiles)
      latestFiles = allFiles.filter(file => latest.has(file))
    } catch (error) {
      this.logger.error('Error getting latest files', error)
    }
    if (latestFiles.length === 0) {
      this.logger.debug('No latest files found, returning all files')
      return allFiles
    }
    if (latestFiles.length !== allFiles.length) {
      this.logger.debug(`Using latest: \n${latestFiles}`)
    }
    return latestFiles
  }

  _getLatestToolVersions(paths: string[]): Set<string> {
    return AbstractFileStore.getLatestToolPaths(paths, path => this._toResultCoordinatesFromStoragePath(path))
  }
}

/**
 * Factory function to create a FileHarvestStore instance.
 */
export default (options?: FileStoreOptions): FileHarvestStore => new FileHarvestStore(options)
