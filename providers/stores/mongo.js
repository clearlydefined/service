// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')

class MongoStore {
  constructor(options) {
    this.options = options
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(
          this.options.connectionString,
          { useNewUrlParser: true }
        )
        this.db = this.client.db(this.options.dbName)
      } catch (error) {
        retry(error)
      }
    })
  }

  get definitions() {
    return this.db.collection('definitions')
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates, type = 'entity') {
    const list = await this.definitionModel.find({ id: this._getId(coordinates) }, 'id')
    return list.map(entry => entry.id)
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
    return this.definitions.findOne({ id: this._getId(coordinates) }, { projection: { _id: 0, id: 0 } })
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
    return null
  }

  store(coordinates, definition) {
    definition.id = definition.id || definition.coordinates.toString()
    return this.definitions.replaceOne({ id: definition.id }, definition, { upsert: true })
  }

  delete(coordinates) {
    return this.definitions.deleteOne({ id: definition.coordinates.toString() })
  }

  _getId(coordinates) {
    return EntityCoordinates.fromObject(coordinates).toString()
  }
}

module.exports = options => new MongoStore(options)
