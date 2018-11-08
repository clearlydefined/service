// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractAzBlobStore = require('./abstractAzblobStore')
const AbstractFileStore = require('./abstractFileStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { sortedUniq } = require('lodash')
const { promisify } = require('util')

class AzBlobDefinitionStore extends AbstractAzBlobStore {
  /**
   * List all of the definitions for the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
    const list = await super.list(coordinates, entry => {
      const path = entry.metadata.id
      if (!path) return null
      const entryCoordinates = EntityCoordinates.fromString(path)
      return AbstractFileStore.isInterestingCoordinates(entryCoordinates) ? path : null
    })
    return sortedUniq(list.filter(x => x))
  }

  store(definition) {
    const blobName = this._toStoragePathFromCoordinates(definition.coordinates) + '.json'
    return promisify(this.blobService.createBlockBlobFromText)(
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

  async delete(coordinates) {
    const blobName = this._toStoragePathFromCoordinates(coordinates) + '.json'
    try {
      await promisify(this.blobService.deleteBlob)(this.containerName, blobName)
    } catch (error) {
      if (error.code !== 'BlobNotFound') throw error
    }
  }
}

module.exports = options => new AzBlobDefinitionStore(options)
