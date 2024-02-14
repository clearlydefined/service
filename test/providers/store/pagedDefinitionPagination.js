// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/mongo')
const shouldPaginateSearchCorrectly = require('./mongoDefinitionPagination')

const dbOptions = {
  collectionName: 'definitions-paged'
}

describe('Mongo Definition Store: Paged', function () {
  before('setup store factory', async function () {
    this.createStore = createStore
  })

  shouldPaginateSearchCorrectly()
})

async function createStore(options, defs) {
  const mongoStore = Store({ ...options, ...dbOptions })
  await mongoStore.initialize()
  await mongoStore.collection.createIndex({ '_mongo.partitionKey': 1 })
  await mongoStore.collection.insertMany(defs)
  return mongoStore
}
