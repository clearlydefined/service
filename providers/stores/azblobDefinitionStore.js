// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractAzBlobStore = require('./abstractAzblobStore')
const AbstractFileStore = require('./abstractFileStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { sortedUniq } = require('lodash')

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

  async store(definition) {
    const blobName = this._toStoragePathFromCoordinates(definition.coordinates) + '.json'
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    const content = JSON.stringify(definition)
    await blockBlobClient.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      metadata: { id: definition.coordinates.toString() }
    })
  }

  async delete(coordinates) {
    const blobName = this._toStoragePathFromCoordinates(coordinates) + '.json'
    const blobClient = this.containerClient.getBlobClient(blobName)
    try {
      await blobClient.delete()
    } catch (error) {
      if (error.statusCode !== 404) throw error
    }
  }
}

module.exports = options => new AzBlobDefinitionStore(options)
