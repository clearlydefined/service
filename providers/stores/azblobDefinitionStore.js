// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractAzBlobStore = require('./abstractAzblobStore')
const AbstractFileStore = require('./abstractFileStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { sortedUniq } = require('lodash')

const resultOrError = (resolve, reject) => (error, result) => (error ? reject(error) : resolve(result))
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

  /**
   * Get the attachment object by AttachmentCoordinates.
   * The result object contains metadata about the attachment as well as the attachment itself
   * If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {AttachmentCoordinates} coordinates - The coordinates of the attachment to get
   * @param {WriteStream} [stream] - The stream onto which the output is written, if specified
   * @returns The result object if no stream is specified, otherwise the return value is unspecified.
   */
  async getAttachment(coordinates, stream) {
    let name = coordinates.toString()
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
}

module.exports = options => new AzBlobDefinitionStore(options)
