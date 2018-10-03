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
   * Get and return the object at the given coordinates.
   *
   * @param {Coordinates} coordinates - The coordinates of the object to get
   * @returns The loaded object
   */
  get(coordinates, stream) {
    return this.definitions.findOne({ id: this._getId(coordinates) }, { projection: { _id: 0, id: 0 } })
  }

  store(coordinates, definition) {
    definition.id = this._getId(definition.coordinates)
    return this.definitions.replaceOne({ id: definition.id }, definition, { upsert: true })
  }

  delete(coordinates) {
    return this.definitions.deleteOne({ id: this._getId(definition.coordinates) })
  }

  _getId(coordinates) {
    return EntityCoordinates.fromObject(coordinates).toString()
  }
}

module.exports = options => new MongoStore(options)
