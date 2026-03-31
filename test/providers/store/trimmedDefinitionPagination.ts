import assert from 'node:assert/strict'
import { describe, before } from 'node:test'
// @ts-nocheck
// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Store from '../../../providers/stores/trimmedMongoDefinitionStore.js'
import shouldPaginateSearchCorrectly from './mongoDefinitionPagination.ts'

const dbOptions = {
  collectionName: 'definitions-trimmed'
}

describe('Mongo Definition Store: Trimmed', () => {
  before(async function () {
    this.createStore = createStore
  })

  shouldPaginateSearchCorrectly()
})

async function createStore(options, defs) {
  const mongoStore = Store({ ...options, ...dbOptions })
  await mongoStore.initialize()
  for (const def of defs) {
    delete def._mongo
  }
  await mongoStore.collection.insertMany(defs)
  return mongoStore
}
