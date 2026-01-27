// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./abstractAzblobStore').AzBlobStoreOptions} AzBlobStoreOptions
 * @typedef {import('./abstractAzblobStore').BlobEntry} BlobEntry
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinatesType
 * @typedef {import('./azblobDefinitionStore').Definition} Definition
 */

const AbstractAzBlobStore = require('./abstractAzblobStore')
const AbstractFileStore = require('./abstractFileStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { sortedUniq } = require('lodash')
const { promisify } = require('util')

/**
 * Azure Blob Storage implementation for storing component definitions.
 * Extends AbstractAzBlobStore with definition-specific functionality.
 */
class AzBlobDefinitionStore extends AbstractAzBlobStore {
  /**
   * List all of the definitions for the given coordinates.
   *
   * @override
   * @param {EntityCoordinatesType} coordinates - Accepts partial coordinates
   * @returns {Promise<string[]>} A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  // @ts-expect-error - Simplified list signature (visitor is handled internally)
  async list(coordinates) {
    const list = await super.list(
      coordinates,
      /** @param {BlobEntry} entry */ entry => {
        const path = entry.metadata['id']
        if (!path) return null
        const entryCoordinates = EntityCoordinates.fromString(path)
        return AbstractFileStore.isInterestingCoordinates(entryCoordinates) ? path : null
      }
    )
    return sortedUniq(list.filter(/** @param {string|null} x */ x => x))
  }

  /**
   * Store a definition in Azure Blob Storage.
   *
   * @param {Definition} definition - The definition to store
   * @returns {Promise<void>} Promise that resolves when the definition is stored
   */
  store(definition) {
    const blobName = this._toStoragePathFromCoordinates(definition.coordinates) + '.json'
    return promisify(this.blobService.createBlockBlobFromText).bind(this.blobService)(
      this.containerName,
      blobName,
      JSON.stringify(definition),
      {
        blockIdPrefix: 'block',
        contentSettings: { contentType: 'application/json' },
        metadata: { id: definition.coordinates.toString() }
      }
    )
  }

  /**
   * Delete a definition from Azure Blob Storage.
   *
   * @param {EntityCoordinatesType} coordinates - The coordinates of the definition to delete
   * @returns {Promise<void>} Promise that resolves when the definition is deleted
   */
  async delete(coordinates) {
    const blobName = this._toStoragePathFromCoordinates(coordinates) + '.json'
    try {
      await promisify(this.blobService.deleteBlob).bind(this.blobService)(this.containerName, blobName)
    } catch (/** @type {any} */ error) {
      if (error.code !== 'BlobNotFound') throw error
    }
  }
}

/**
 * Factory function to create an AzBlobDefinitionStore instance.
 *
 * @param {AzBlobStoreOptions} options - Configuration options for the store
 * @returns {AzBlobDefinitionStore} A new AzBlobDefinitionStore instance
 */
module.exports = options => new AzBlobDefinitionStore(options)
