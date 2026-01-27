// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('stream').Writable} Writable
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinatesType
 * @typedef {import('../../lib/resultCoordinates')} ResultCoordinatesType
 * @typedef {import('./abstractAzblobStore').AzBlobStoreOptions} AzBlobStoreOptions
 * @typedef {import('./azblobHarvestStore').ToolOutputs} ToolOutputs
 * @typedef {import('./azblobHarvestStore').BlobFileEntry} BlobFileEntry
 */

const AbstractAzBlobStore = require('./abstractAzblobStore')
const AbstractFileStore = require('./abstractFileStore')
const ResultCoordinates = require('../../lib/resultCoordinates')
const { sortedUniq } = require('lodash')

/**
 * Helper to create callback for Promise resolve/reject
 * @param {(value: any) => void} resolve
 * @param {(reason?: any) => void} reject
 * @returns {(error: any, result: any) => void}
 */
const resultOrError = (resolve, reject) => (error, result) => (error ? reject(error) : resolve(result))
/**
 * Helper to create callback for Promise resolve/reject with response
 * @param {(value: any) => void} resolve
 * @param {(reason?: any) => void} reject
 * @returns {(error: any, result: any, response: any) => void}
 */
const responseOrError = (resolve, reject) => (error, _result, response) => (error ? reject(error) : resolve(response))

/**
 * Azure Blob Storage implementation for storing harvest results.
 * Extends AbstractAzBlobStore with harvest-specific functionality.
 */
class AzHarvestBlobStore extends AbstractAzBlobStore {
  /**
   * List all of the results for the given coordinates.
   *
   * @override
   * @param {EntityCoordinatesType | ResultCoordinatesType} coordinates - Accepts partial coordinates
   * @returns {Promise<string[]>} A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3/tool/scancode/2.9.2' ]
   */
  // @ts-expect-error - Simplified list signature (visitor is handled internally)
  async list(coordinates) {
    const list = await super.list(
      coordinates,
      /** @param {any} entry */ entry => {
        const urn = entry.metadata.urn
        if (!urn) return null
        const entryCoordinates = ResultCoordinates.fromUrn(urn)
        return AbstractFileStore.isInterestingCoordinates(entryCoordinates) ? entryCoordinates.toString() : null
      }
    )
    return sortedUniq(list.filter(/** @param {any} x */ x => x))
  }

  /**
   * Stream the content identified by the coordinates onto the given stream and close the stream.
   *
   * @param {ResultCoordinatesType} coordinates - The coordinates of the content to access
   * @param {Writable} stream - The stream onto which the output is written
   * @returns {Promise<any>} Promise that resolves with the response when streaming is complete
   */
  stream(coordinates, stream) {
    let name = this._toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) name += '.json'
    return new Promise((resolve, reject) =>
      this.blobService.getBlobToStream(this.containerName, name, stream, responseOrError(resolve, reject))
    )
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision.
   *
   * @param {EntityCoordinatesType} coordinates - The component revision to report on
   * @returns {Promise<ToolOutputs>} An object with a property for each tool and tool version
   */
  async getAll(coordinates) {
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const allFilesList = await this._getListOfAllFiles(coordinates)
    return await this._getContent(allFilesList)
  }

  /**
   * Get list of all blob files for the given coordinates.
   *
   * @private
   * @param {EntityCoordinatesType} coordinates - The coordinates to list files for
   * @returns {Promise<BlobFileEntry[]>} List of blob file entries
   */
  _getListOfAllFiles(coordinates) {
    const name = this._toStoragePathFromCoordinates(coordinates)
    return new Promise((resolve, reject) =>
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject))
    ).then(files =>
      files.entries.filter(
        /** @param {any} file */ file => {
          return (
            file.name.length === name.length || // either an exact match, or
            (file.name.length > name.length && // a longer string
              (file.name[name.length] === '/' || // where the next character starts extra tool indications
                file.name.substr(name.length) === '.json'))
          )
        }
      )
    )
  }

  /**
   * Get content for all provided files and organize by tool/version.
   *
   * @private
   * @param {BlobFileEntry[]} files - List of blob file entries to fetch
   * @returns {Promise<ToolOutputs>} Tool outputs organized by tool name and version
   */
  _getContent(files) {
    const contents = Promise.all(
      files.map(file => {
        return new Promise((resolve, reject) =>
          this.blobService.getBlobToText(this.containerName, file.name, resultOrError(resolve, reject))
        ).then(result => {
          return { name: file.name, content: JSON.parse(result) }
        })
      })
    )
    return contents.then(entries => {
      /** @type {Record<string, Record<string, any>>} */
      const result = {}
      return entries.reduce((result, entry) => {
        const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name)
        // TODO: LOG HERE THERE IF THERE ARE SOME BOGUS FILES HANGING AROUND
        if (!tool || !toolVersion) return result
        const current = (result[tool] = result[tool] || {})
        current[toolVersion] = entry.content
        return result
      }, result)
    })
  }

  /**
   * Get the latest version of each tool output for the given coordinates. The coordinates must be all the way down
   * to a revision.
   *
   * @param {EntityCoordinatesType} coordinates - The component revision to report on
   * @returns {Promise<ToolOutputs>} A promise that resolves to an object with a property for each tool and tool version
   */
  async getAllLatest(coordinates) {
    const allFilesList = await this._getListOfAllFiles(coordinates)
    const latestFilesList = this._getListOfLatestFiles(allFilesList)
    return await this._getContent(latestFilesList)
  }

  /**
   * Filter list of files to only include latest version of each tool.
   *
   * @private
   * @param {BlobFileEntry[]} allFiles - All blob file entries
   * @returns {BlobFileEntry[]} Filtered list with only latest versions
   */
  _getListOfLatestFiles(allFiles) {
    /** @type {BlobFileEntry[]} */
    let latestFiles = []
    const names = allFiles.map(file => file.name)
    try {
      const latest = this._getLatestToolPaths(names)
      latestFiles = allFiles.filter(file => latest.has(file.name))
    } catch (error) {
      this.logger.error('Error getting latest files', error)
    }
    return latestFiles.length === 0 ? allFiles : latestFiles
  }

  /**
   * Get the set of paths that represent the latest tool versions.
   *
   * @private
   * @param {string[]} paths - All file paths
   * @returns {Set<string>} Set of paths for latest versions
   */
  _getLatestToolPaths(paths) {
    return AbstractFileStore.getLatestToolPaths(paths, path => this._toResultCoordinatesFromStoragePath(path))
  }
}

/**
 * Factory function to create an AzHarvestBlobStore instance.
 *
 * @param {AzBlobStoreOptions} options - Configuration options for the store
 * @returns {AzHarvestBlobStore} A new AzHarvestBlobStore instance
 */
module.exports = options => new AzHarvestBlobStore(options)
