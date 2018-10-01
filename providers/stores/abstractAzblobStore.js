// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const AbstractFileStore = require('./abstractFileStore')

const resultOrError = (resolve, reject) => (error, result) => (error ? reject(error) : resolve(result))

class AbstractAzBlobStore {
  constructor(options) {
    this.options = options
    this.containerName = options.containerName
  }

  async initialize() {
    const blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    Object.defineProperty(this, 'blobService', { value: blobService, writable: false, configurable: true })
    this.blobService.createContainerIfNotExists(this.containerName, () => {})
    return this.blobService
  }

  /**
   * Visit all of the blobs associated with the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates.
   * @returns The collection of results returned by the visitor
   */
  async list(coordinates, visitor) {
    const list = []
    let continuation = null
    do {
      const result = await new Promise((resolve, reject) => {
        const name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
        this.blobService.listBlobsSegmentedWithPrefix(
          this.containerName,
          name,
          continuation,
          { include: azure.BlobUtilities.BlobListingDetails.METADATA },
          resultOrError(resolve, reject)
        )
      })
      continuation = result.continuationToken
      result.entries.forEach(entry => list.push(visitor(entry)))
    } while (continuation)
    return list
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {Coordinates} coordinates - The coordinates of the object to get
   * @returns The loaded object
   */
  get(coordinates) {
    let name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) name += '.json'
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

  _toStoragePathFromCoordinates(coordinates) {
    return AbstractFileStore.toStoragePathFromCoordinates(coordinates)
  }

  _toResultCoordinatesFromStoragePath(path) {
    return AbstractFileStore.toResultCoordinatesFromStoragePath(path)
  }
}

module.exports = AbstractAzBlobStore
