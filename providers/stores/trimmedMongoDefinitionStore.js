// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractMongoDefinitionStore = require('./abstractMongoDefinitionStore')
const { clone } = require('lodash')

class TrimmedMongoDefinitionStore extends AbstractMongoDefinitionStore {
  // eslint-disable-next-line no-unused-vars
  async list(coordinates) {
    //This store does not support list for coordinates
    return null
  }

  // eslint-disable-next-line no-unused-vars
  async get(coordinates) {
    //This store does not support get definition
    return null
  }

  async find(query, continuationToken = '', pageSize) {
    const result = await super.find(query, continuationToken, pageSize)
    result.data.forEach(def => delete def._id)
    return result
  }

  async store(definition) {
    const definitionDoc = clone(definition)
    definitionDoc._id = this.getId(definition.coordinates)
    delete definitionDoc.files
    return await this.collection.replaceOne({ _id: definitionDoc._id }, definitionDoc, { upsert: true })
  }

  async delete(coordinates) {
    await this.collection.deleteOne({ _id: this.getId(coordinates) })
    return null
  }

  getCoordinatesKey() {
    return '_id'
  }
}

module.exports = options => new TrimmedMongoDefinitionStore(options)
