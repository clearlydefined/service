// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const AbstractFileStore = require('./abstractFileStore')
const logger = require('../logging/logger')
const EntityCoordinates = require('../../lib/entityCoordinates')

const { promisify } = require('util')

class AbstractAzBlobStore {
  constructor(options) {
    this.options = options
    this.containerName = options.containerName
    this.logger = logger()
  }

  async initialize() {
    this.blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    return promisify(this.blobService.createContainerIfNotExists).bind(this.blobService)(this.containerName)
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
      const name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
      const result = await promisify(this.blobService.listBlobsSegmentedWithPrefix).bind(this.blobService)(
        this.containerName,
        name,
        continuation,
        {
          include: azure.BlobUtilities.BlobListingDetails.METADATA
        }
      )
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
  async get(coordinates) {
    let name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) name += '.json'
    try {
      const result = await promisify(this.blobService.getBlobToText).bind(this.blobService)(this.containerName, name)
      return JSON.parse(result)
    } catch (error) {
      if (error.statusCode === 404) return null
      throw error
    }
  }

  /**
   * Query and return the objects based on the query
   *
   * @param {object} query - The filters and sorts for the request
   * @returns The data and continuationToken if there is more results
   */
  async find(query, continuationToken = '') {
    const prefix = this._buildPrefix(query)
    const result = await promisify(this.blobService.listBlobsSegmentedWithPrefix).bind(this.blobService)(
      this.containerName,
      prefix,
      continuationToken,
      {
        include: azure.BlobUtilities.BlobListingDetails.METADATA
      }
    )
    const data = []
    result.entries
      .forEach(entry => {
        const path = entry.metadata.id
        if (!path) return
        data.push(this.get(EntityCoordinates.fromString(path)))
      })
      .filter(x => x)
    return { data, continuationToken: result.continuationToken }
  }

  _toStoragePathFromCoordinates(coordinates) {
    return AbstractFileStore.toStoragePathFromCoordinates(coordinates)
  }

  _toResultCoordinatesFromStoragePath(path) {
    return AbstractFileStore.toResultCoordinatesFromStoragePath(path)
  }

  _buildPrefix(parameters) {
    let result = ''
    if (!parameters.type) return result
    result += `${parameters.type}/`
    if (!parameters.provider) return result
    result += `${parameters.provider}/`
    if (!parameters.namespace) return result
    result += `${parameters.namespace}/`
    if (!parameters.name) return result
    result += `${parameters.name}/`
    return result
  }
}

module.exports = AbstractAzBlobStore
