// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractAzBlobStore = require('./abstractAzblobStore')
const AbstractFileStore = require('./abstractFileStore')
const ResultCoordinates = require('../../lib/resultCoordinates')
const { sortedUniq } = require('lodash')

const resultOrError = (resolve, reject) => (error, result) => (error ? reject(error) : resolve(result))
const responseOrError = (resolve, reject) => (error, result, response) => (error ? reject(error) : resolve(response))

class AzHarvestBlobStore extends AbstractAzBlobStore {
  /**
   * List all of the results for the given coordinates.
   *
   * @param {ResultCoordinates} coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3/tool/scancode/2.9.2' ]
   */
  async list(coordinates) {
    const list = await super.list(coordinates, entry => {
      const urn = entry.metadata.urn
      if (!urn) return null
      const entryCoordinates = ResultCoordinates.fromUrn(urn)
      return AbstractFileStore.isInterestingCoordinates(entryCoordinates) ? entryCoordinates.toString() : null
    })
    return sortedUniq(list.filter(x => x))
  }

  /**
   * Stream the content identified by the coordinates onto the given the stream and close the stream.
   *
   * @param {ResultCoordinates} coordinates - The coordinates of the content to access
   * @param {WriteStream} [stream] - The stream onto which the output is written
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
   * @param {EntityCoordinates} coordinates - The component revision to report on
   * @returns An object with a property for each tool and tool version
   */
  async getAll(coordinates) {
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const files = await this._getAllFiles(coordinates)
    return await this._getContent(files)
  }

  _getAllFiles(coordinates) {
    const name = this._toStoragePathFromCoordinates(coordinates)
    return new Promise((resolve, reject) =>
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject))
    ).then(files =>
      files.entries.filter(file => {
        return (
          file.name.length === name.length || // either an exact match, or
          (file.name.length > name.length && // a longer string
            (file.name[name.length] === '/' || // where the next character starts extra tool indications
              file.name.substr(name.length) === '.json'))
        )
      })
    )
  }

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
      return entries.reduce((result, entry) => {
        const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name)
        // TODO: LOG HERE THERE IF THERE ARE SOME BOGUS FILES HANGING AROUND
        if (!tool || !toolVersion) return result
        const current = (result[tool] = result[tool] || {})
        current[toolVersion] = entry.content
        return result
      }, {})
    })
  }

  /**
   * Get the latest version of each tool output for the given coordinates. The coordinates must be all the way down
   * to a revision.
   * @param {EntityCoordinates} coordinates - The component revision to report on
   * @returns {Promise} A promise that resolves to an object with a property for each tool and tool version
   *
   */
  async getAllLatest(coordinates) {
    const allFiles = await this._getAllFiles(coordinates)
    const latestFiles = this._getLatestFiles(allFiles)
    return await this._getContent(latestFiles)
  }

  _getLatestFiles(allFiles) {
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

  _getLatestToolPaths(paths) {
    return AbstractFileStore.getLatestToolPaths(paths, path => this._toResultCoordinatesFromStoragePath(path))
  }
}

module.exports = options => new AzHarvestBlobStore(options)
