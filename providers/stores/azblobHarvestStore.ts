// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Writable } from 'node:stream'
import lodash from 'lodash'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { ResultCoordinates } from '../../lib/resultCoordinates.ts'
import ResultCoordinatesClass from '../../lib/resultCoordinates.ts'
import type { AzBlobStoreOptions } from './abstractAzblobStore.ts'
import AbstractAzBlobStore from './abstractAzblobStore.ts'
import AbstractFileStore from './abstractFileStore.ts'

const { sortedUniq } = lodash

/** Tool output results organized by tool name and version */
export interface ToolOutputs {
  [toolName: string]: {
    [toolVersion: string]: any
  }
}

/** Azure blob file entry */
export interface BlobFileEntry {
  /** Name/path of the blob */
  name: string
}

const resultOrError = (resolve: (value: any) => void, reject: (reason?: any) => void) => (error: any, result: any) =>
  error ? reject(error) : resolve(result)
const responseOrError =
  (resolve: (value: any) => void, reject: (reason?: any) => void) => (error: any, _result: any, response: any) =>
    error ? reject(error) : resolve(response)

/**
 * Azure Blob Storage implementation for storing harvest results.
 * Extends AbstractAzBlobStore with harvest-specific functionality.
 */
export class AzHarvestBlobStore extends AbstractAzBlobStore {
  /**
   * List all of the results for the given coordinates.
   */
  // @ts-expect-error - Simplified list signature (visitor is handled internally)
  override async list(coordinates: EntityCoordinates | ResultCoordinates): Promise<string[]> {
    const list = await super.list(coordinates, (entry: any) => {
      const urn = entry.metadata.urn
      if (!urn) {
        return null
      }
      const entryCoordinates = ResultCoordinatesClass.fromUrn(urn)
      return AbstractFileStore.isInterestingCoordinates(entryCoordinates) ? entryCoordinates.toString() : null
    })
    return sortedUniq(list.filter((x: any) => x))
  }

  /**
   * Stream the content identified by the coordinates onto the given stream and close the stream.
   */
  stream(coordinates: ResultCoordinates, stream: Writable): Promise<any> {
    let name = this._toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) {
      name += '.json'
    }
    return new Promise((resolve, reject) =>
      this.blobService.getBlobToStream(this.containerName, name, stream, responseOrError(resolve, reject))
    )
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision.
   */
  async getAll(coordinates: EntityCoordinates): Promise<ToolOutputs> {
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const allFilesList = await this._getListOfAllFiles(coordinates)
    return await this._getContent(allFilesList)
  }

  _getListOfAllFiles(coordinates: EntityCoordinates): Promise<BlobFileEntry[]> {
    const name = this._toStoragePathFromCoordinates(coordinates)
    return new Promise<any>((resolve, reject) =>
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject))
    ).then(files =>
      files.entries.filter((file: any) => {
        return (
          file.name.length === name.length || // either an exact match, or
          (file.name.length > name.length && // a longer string
            (file.name[name.length] === '/' || // where the next character starts extra tool indications
              file.name.substr(name.length) === '.json'))
        )
      })
    )
  }

  _getContent(files: BlobFileEntry[]): Promise<ToolOutputs> {
    const contents = Promise.all(
      files.map(file => {
        return new Promise((resolve, reject) =>
          this.blobService.getBlobToText(this.containerName, file.name, resultOrError(resolve, reject))
        ).then(result => {
          return { name: file.name, content: JSON.parse(result as string) }
        })
      })
    )
    return contents.then(entries => {
      const result: Record<string, Record<string, any>> = {}
      return entries.reduce((result, entry) => {
        const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name)
        // TODO: LOG HERE THERE IF THERE ARE SOME BOGUS FILES HANGING AROUND
        if (!tool || !toolVersion) {
          return result
        }
        result[tool] = result[tool] || {}
        const current = result[tool]
        current[toolVersion] = entry.content
        return result
      }, result)
    })
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

  _getListOfLatestFiles(allFiles: BlobFileEntry[]): BlobFileEntry[] {
    let latestFiles: BlobFileEntry[] = []
    const names = allFiles.map(file => file.name)
    try {
      const latest = this._getLatestToolPaths(names)
      latestFiles = allFiles.filter(file => latest.has(file.name))
    } catch (error) {
      this.logger.error('Error getting latest files', error)
    }
    return latestFiles.length === 0 ? allFiles : latestFiles
  }

  _getLatestToolPaths(paths: string[]): Set<string> {
    return AbstractFileStore.getLatestToolPaths(paths, path => this._toResultCoordinatesFromStoragePath(path))
  }
}

/**
 * Factory function to create an AzHarvestBlobStore instance.
 */
export default (options: AzBlobStoreOptions): AzHarvestBlobStore => new AzHarvestBlobStore(options)
