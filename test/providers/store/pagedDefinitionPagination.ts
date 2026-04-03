// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Store from '../../../providers/stores/mongo.js'
import shouldPaginateSearchCorrectly from './mongoDefinitionPagination.ts'

const dbOptions = {
  collectionName: 'definitions-paged'
}

describe('Mongo Definition Store: Paged', () => {
  before('setup store factory', async function () {
    this.createStore = createStore
  })

  shouldPaginateSearchCorrectly()
})

async function createStore(options, defs) {
  const mongoStore = Store({ ...options, ...dbOptions })
  await mongoStore.initialize()
  await (mongoStore as any).collection.createIndex({ '_mongo.partitionKey': 1 })
  await (mongoStore as any).collection.insertMany(defs)
  return mongoStore
}
