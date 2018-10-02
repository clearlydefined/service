// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractAzBlobStore = require('./abstractAzblobStore')
const AbstractFileStore = require('./abstractFileStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { sortedUniq } = require('lodash')

const responseOrError = (resolve, reject) => (error, result, response) => (error ? reject(error) : resolve(response))

class AzBlobDefinitionStore extends AbstractAzBlobStore {
  /**
   * List all of the definitions for the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
    const list = await super.list(coordinates, entry => {
      const urn = entry.metadata.urn
      if (!urn) return null
      const entryCoordinates = EntityCoordinates.fromUrn(urn)
      return AbstractFileStore.isInterestingCoordinates(entryCoordinates) ? entryCoordinates.toString() : null
    })
    return sortedUniq(list.filter(x => x))
  }

  store(coordinates, stream) {
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

module.exports = options => new AzBlobDefinitionStore(options)
