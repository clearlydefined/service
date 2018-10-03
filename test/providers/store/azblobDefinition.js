// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/azblobDefinitionStore')
const sinon = require('sinon')
const { expect } = require('chai')
const EntityCoordinates = require('../../../lib/entityCoordinates')

describe('azblob Definition store', () => {
  it('throws original error', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/co/4.6.1' } }
    }
    const store = createAzBlobStore(data)
    try {
      await store.list(EntityCoordinates.fromString('npm/npmjs/-/error/4.6.0'))
      throw new Error('should have thrown error')
    } catch (error) {
      expect(error.message).to.eq('test error')
    }
  })

  it('should list one coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/co/4.6.1' } }
    }
    const store = createAzBlobStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/bogus/4.6.0'))
    expect(result.length).to.eq(0)
  })

  it('should list one coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/co/4.6.1' } }
    }
    const store = createAzBlobStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.0'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/co/4.6.0'])
  })

  it('should list coordinates preserving case from blob metadata', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createAzBlobStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/Co/4.6.1'])
  })

  it('list coordinates with partial coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createAzBlobStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/Co/4.6.0', 'npm/npmjs/-/Co/4.6.1'])
  })
})

function createAzBlobStore(data) {
  const blobServiceStub = {
    listBlobsSegmentedWithPrefix: sinon.stub().callsFake(async (container, name, continuation, metadata, callback) => {
      name = name.toLowerCase()
      if (name.includes('error')) return callback(new Error('test error'))
      callback(null, {
        continuation: null,
        entries: Object.keys(data)
          .map(key => (key.startsWith(name) ? data[key] : null))
          .filter(e => e)
      })
    })
  }
  const store = Store({})
  store.blobService = blobServiceStub
  return store
}
