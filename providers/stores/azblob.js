// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const AbstractStore = require('./abstractStore')
const EntityCoordinates = require('../../lib/entityCoordinates')

const resultOrError = (resolve, reject) => (error, result) => (error ? reject(error) : resolve(result))
const responseOrError = (resolve, reject) => (error, result, response) => (error ? reject(error) : resolve(response))

class AzBlobStore extends AbstractStore {
  constructor(options) {
    super()
    this.options = options
    this.containerName = options.containerName
  }

  get blobService() {
    const blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    Object.defineProperty(this, 'blobService', { value: blobService, writable: false, configurable: true })
    this.blobService.createContainerIfNotExists(this.containerName, () => {})
    return this.blobService
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
    const list = new Set()
    let continuation = null
    do {
      const result = await new Promise((resolve, reject) => {
        const name = this._toStoragePathFromCoordinates(coordinates)
        this.blobService.listBlobsSegmentedWithPrefix(
          this.containerName,
          name,
          continuation,
          { include: azure.BlobUtilities.BlobListingDetails.METADATA },
          resultOrError(resolve, reject)
        )
      })
      result.entries.forEach(entry => {
        const urn = entry.metadata.urn
        if (urn) list.add(EntityCoordinates.fromUrn(urn).toString())
      })
      continuation = result.continuationToken
    } while (continuation)
    return Array.from(list).sort()
  }

  /**
   * List all of the matching tool output coordinates
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3/clearlydefined/1', 'npm/npmjs/-/JSONStream/1.3.3/scancode/2.9.2' ]
   */
  async listResults(coordinates) {
    const list = new Set()
    let continuation = null
    do {
      const result = await new Promise((resolve, reject) => {
        const name = this._toStoragePathFromCoordinates(coordinates)
        this.blobService.listBlobsSegmentedWithPrefix(
          this.containerName,
          name,
          continuation,
          { include: azure.BlobUtilities.BlobListingDetails.METADATA },
          resultOrError(resolve, reject)
        )
      })
      result.entries.forEach(entry => {
        const urn = entry.metadata.urn
        if (urn) {
          const value = this._toPreservedCoordinatesFromResultsStoragePath(
            entry.name,
            EntityCoordinates.fromUrn(urn).toString()
          )
          if (value) list.add(value)
        }
      })
      continuation = result.continuationToken
    } while (continuation)
    return Array.from(list).sort()
  }

  /**
   * Get the results of running the tool specified in the coordinates on the entty specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {ResultCoordinates} coordinates - The coordinates of the result to get
   * @param {WriteStream} [stream] - The stream onto which the output is written, if specified
   * @returns The result object if no stream is specified, otherwise the return value is unspecified.
   */
  get(coordinates, stream) {
    let name = this._toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) name += '.json'
    if (stream)
      return new Promise((resolve, reject) => {
        this.blobService.getBlobToStream(this.containerName, name, stream, responseOrError(resolve, reject))
      })
    return new Promise((resolve, reject) => {
      this.blobService.getBlobToText(this.containerName, name, resultOrError(resolve, reject))
    }).then(
      result => JSON.parse(result),
      error => {
        if (error.statusCode === 404) return null
        throw error
      }
    )
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision.
   * @param {EntityCoordinates} coordinates - The component revision to report on
   * @returns An object with a property for each tool and tool version
   */
  getAll(coordinates) {
    const name = this._toStoragePathFromCoordinates(coordinates)
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const list = new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject))
    })
    const contents = list.then(files => {
      return Promise.all(
        files.entries.map(file => {
          return new Promise((resolve, reject) => {
            this.blobService.getBlobToText(this.containerName, file.name, resultOrError(resolve, reject))
          }).then(result => {
            return { name: file.name, content: JSON.parse(result) }
          })
        })
      )
    })
    return contents.then(entries => {
      return entries.reduce((result, entry) => {
        const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name)
        if (!tool || !toolVersion) {
          // TODO: LOG HERE THERE ARE SOME BOGUS FILES HANGING AROUND
          return result
        }
        const current = (result[tool] = result[tool] || {})
        current[toolVersion] = entry.content
        return result
      }, {})
    })
  }

  async store(coordinates, stream) {
    const name = this._toStoragePathFromCoordinates(coordinates) + '.json'
    return new Promise((resolve, reject) => {
      stream.pipe(
        this.blobService.createWriteStreamToBlockBlob(
          this.containerName,
          name,
          { blockIdPrefix: 'block', contentSettings: { contentType: 'application/json' } },
          responseOrError(resolve, reject)
        )
      )
    })
  }

  delete(coordinates) {
    const blobName = this._toStoragePathFromCoordinates(coordinates) + '.json'
    return new Promise((resolve, reject) =>
      this.blobService.deleteBlob(this.containerName, blobName, responseOrError(resolve, reject))
    )
  }
}

module.exports = options => new AzBlobStore(options)
