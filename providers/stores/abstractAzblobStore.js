// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const AbstractFileStore = require('./abstractFileStore')
const logger = require('../logging/logger')

const { promisify } = require('util')

/**
 * @typedef {import('./abstractAzblobStore').AzBlobStoreOptions} AzBlobStoreOptions
 * @typedef {import('./abstractAzblobStore').BlobEntry} BlobEntry
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('../../lib/resultCoordinates')} ResultCoordinates
 * @typedef {import('../logging').Logger} Logger
 */

/**
 * Abstract base class for Azure Blob Storage implementations.
 * Provides common functionality for reading and writing JSON to Azure Blob Storage.
 */
class AbstractAzBlobStore {
  /**
   * Creates a new AbstractAzBlobStore instance
   *
   * @param {AzBlobStoreOptions} options - Configuration options for the store
   */
  constructor(options) {
    /** @type {AzBlobStoreOptions} */
    this.options = options
    /** @type {string} */
    this.containerName = options.containerName
    /** @type {Logger} */
    this.logger = this.options.logger || logger()
  }

  /**
   * Initializes the blob service and creates the container if needed
   *
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async initialize() {
    this.blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    return promisify(this.blobService.createContainerIfNotExists).bind(this.blobService)(this.containerName)
  }

  /**
   * Visit all of the blobs associated with the given coordinates.
   *
   * @template T
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates.
   * @param {function(BlobEntry): T | null} visitor - Function to apply to each blob entry
   * @returns {Promise<T[]>} The collection of results returned by the visitor
   */
  async list(coordinates, visitor) {
    /** @type {any[]} */
    const list = []
    let continuation = null
    do {
      const name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
      // @ts-ignore - azure-storage promisify signature differs from standard promisify
      const result = await promisify(this.blobService.listBlobsSegmentedWithPrefix).bind(this.blobService)(
        this.containerName,
        name,
        continuation,
        // @ts-ignore - azure-storage expects 4 args for this operation
        {
          include: azure.BlobUtilities.BlobListingDetails.METADATA
        }
      )
      continuation = result.continuationToken
      result.entries.forEach(
        /** @param {BlobEntry} entry */ entry => {
          const visitResult = visitor(entry)
          if (visitResult !== null) list.push(visitResult)
        }
      )
    } while (continuation)
    return list
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - The coordinates of the object to get
   * @returns {Promise<any>} The loaded object or null if not found
   */
  async get(coordinates) {
    let name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) name += '.json'
    try {
      const result = await promisify(this.blobService.getBlobToText).bind(this.blobService)(this.containerName, name)
      return JSON.parse(result)
    } catch (error) {
      const azureError = /** @type {{statusCode?: number}} */ (error)
      if (azureError.statusCode === 404) return null
      throw error
    }
  }

  /**
   * Unsupported. The Blob definition store is not queryable.
   *
   * @returns {Promise<null>} Always returns null
   */
  async find() {
    return null
  }

  /**
   * Converts coordinates to a storage path
   *
   * @protected
   * @param {EntityCoordinates} coordinates - The coordinates to convert
   * @returns {string} The storage path
   */
  _toStoragePathFromCoordinates(coordinates) {
    return AbstractFileStore.toStoragePathFromCoordinates(coordinates)
  }

  /**
   * Converts a storage path to ResultCoordinates
   *
   * @protected
   * @param {string} path - The storage path to convert
   * @returns {ResultCoordinates} The ResultCoordinates
   */
  _toResultCoordinatesFromStoragePath(path) {
    return AbstractFileStore.toResultCoordinatesFromStoragePath(path)
  }
}

module.exports = AbstractAzBlobStore
