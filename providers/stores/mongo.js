// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')
const { clone, get, range } = require('lodash')

class MongoStore {
  constructor(options) {
    this.logger = logger()
    this.options = options
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(this.options.connectionString, { useNewUrlParser: true })
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection(this.options.collectionName)
      } catch (error) {
        retry(error)
      }
    })
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
    const list = await this.collection.find(
      { _id: new RegExp('^' + this._getId(coordinates)) },
      { projection: { _id: 1 } }
    )
    return (await list.toArray()).map(entry => entry._id)
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {Coordinates} coordinates - The coordinates of the object to get
   * @returns The loaded object
   */
  async get(coordinates) {
    const cursor = await this.collection.find(
      { '_mongo.partitionKey': this._getId(coordinates) },
      { projection: { _id: 0, _mongo: 0 }, sort: { '_mongo.page': 1 } }
    )
    let definition
    await cursor.forEach(page => {
      if (!definition) definition = page
      else definition.files = definition.files.concat(page.files)
    })
    return definition
  }

  /**
   * Get and return the objects at the given coordinates list.
   *
   * @param {Array<Coordinates>} coordinatesList - Array of the coordinates for the objects to get
   * @returns Array of the loaded objects
   */
  async getAll(coordinatesList) {
    const cursor = await this.collection.find(
      { '_mongo.partitionKey': { $in: coordinatesList.map(this._getId).filter(x => x) } },
      { projection: { _id: 0 }, sort: { '_mongo.page': 1 } }
    )
    const definitions = {}
    await cursor.forEach(doc => {
      const partitionKey = doc._mongo.partitionKey
      if (!definitions[partitionKey]) definitions[partitionKey] = doc
      else definitions[partitionKey].files = definitions[partitionKey].files.concat(doc.files)
    })
    const result = Object.values(definitions)
    result.forEach(x => {
      delete x._mongo
    })
    return result
  }

  async store(definition) {
    const pageSize = 1000
    definition._id = this._getId(definition.coordinates)
    await this.collection.deleteMany({ '_mongo.partitionKey': definition._id })
    const pages = Math.ceil((get(definition, 'files.length') || 1) / pageSize)
    const result = await this.collection.insertMany(
      range(pages).map(
        index => {
          if (index === 0) {
            const definitionPage = clone(definition)
            if (definition.files) definitionPage.files = definition.files.slice(0, pageSize)
            return { ...definitionPage, _mongo: { partitionKey: definition._id, page: 1, totalPages: pages } }
          }
          return {
            _id: definition._id + `/${index}`,
            _mongo: {
              partitionKey: definition._id,
              page: index + 1,
              totalPages: pages
            },
            files: definition.files.slice(index * pageSize, index * pageSize + pageSize)
          }
        },
        { ordered: false }
      )
    )
    return result
  }

  async delete(coordinates) {
    await this.collection.deleteMany({ _id: new RegExp(`^${this._getId(coordinates)}(\\/.+)?$`) })
    return null
  }

  _getId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()
  }
}

module.exports = options => new MongoStore(options)
