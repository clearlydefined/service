// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { clone, get, range } = require('lodash')
const AbstractMongoDefinitionStore = require('./abstractMongoDefinitionStore')

class MongoStore extends AbstractMongoDefinitionStore {

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
    const list = await this.collection.find(
      { '_mongo.partitionKey': new RegExp(`^${this.getId(coordinates)}`), '_mongo.page': 1 },
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
      { '_mongo.partitionKey': this.getId(coordinates) },
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
   * Query and return the objects based on the query
   *
   * @param {object} query - The filters and sorts for the request
   * @returns The data and continuationToken if there is more results
   */
  async find(query, continuationToken = '', pageSize = 100) {
    const projection = { _id: 0, files: 0 }
    const result = await super.find(query, continuationToken, pageSize, projection)
    result.data.forEach(def => {
      delete def._mongo
    })
    return result
  }

  async store(definition) {
    const pageSize = 1000
    definition._id = this.getId(definition.coordinates)
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
    await this.collection.deleteMany({ '_mongo.partitionKey': this.getId(coordinates) })
    return null
  }
  
  getCoordinatesKey() {
    return '_mongo.partitionKey'
  }
  
  buildQuery(parameters) {
    const filter = super.buildQuery(parameters)
    return { ...filter, '_mongo.page': 1 } // only get page 1 of each definition
  }

}
module.exports = options => new MongoStore(options)
