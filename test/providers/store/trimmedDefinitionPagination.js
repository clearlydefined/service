// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/trimmedMongoDefinitionStore')
const shouldPaginateSearchCorrectly = require('./mongoDefinitionPagination')

const dbOptions = {
  collectionName: 'definitions-trimmed'
}

describe('Mongo Definition Store: Trimmed', function () {
  before('setup store factory', async function () {
    this.createStore = createStore
  })

  shouldPaginateSearchCorrectly()
})

async function createStore(options, defs) {
  const mongoStore = Store({ ...options, ...dbOptions })
  await mongoStore.initialize()
  defs.forEach(def => delete def._mongo)
  await mongoStore.collection.insertMany(defs)
  return mongoStore
}
