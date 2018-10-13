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
    const store = createStore(data)
    try {
      await store.list(EntityCoordinates.fromString('npm/npmjs/-/error/4.6.0'))
      throw new Error('should have thrown error')
    } catch (error) {
      expect(error.message).to.eq('test error')
    }
  })

  it('should list no coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/bogus/4.6.0'))
    expect(result.length).to.eq(0)
  })

  it('should list one coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.0'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/co/4.6.0'])
  })

  it('should list coordinates preserving case from blob metadata', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/Co/4.6.1'])
  })

  it('list coordinates with partial coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/Co/4.6.0', 'npm/npmjs/-/Co/4.6.1'])
  })

  it('stores a definition', async () => {
    const definition = createDefinition('npm/npmjs/-/foo/1.0')
    const store = createStore()
    await store.store(definition)
    expect(store.blobService.createBlockBlobFromText.callCount).to.eq(1)
    expect(store.blobService.createBlockBlobFromText.args[0][1]).to.eq('npm/npmjs/-/foo/revision/1.0.json')
  })

  it('deletes a definition', async () => {
    const store = createStore()
    await store.delete(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
    expect(store.blobService.deleteBlob.callCount).to.eq(1)
    expect(store.blobService.deleteBlob.args[0][1]).to.eq('npm/npmjs/-/foo/revision/1.0.json')
  })

  it('gets a definition', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': createDefinitionJson('npm/npmjs/-/co/4.6.0'),
      'npm/npmjs/-/co/revision/4.6.1.json': createDefinitionJson('npm/npmjs/-/co/4.6.1'),
      'npm/npmjs/-/co/revision/4.6.2.json': createDefinitionJson('npm/npmjs/-/co/4.6.2')
    }
    const store = createStore(data)
    const result = await store.get(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
    expect(result.coordinates).to.deep.eq(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
  })
})

function createDefinition(coordinates) {
  return { coordinates: EntityCoordinates.fromString(coordinates) }
}

function createDefinitionJson(coordinates) {
  return JSON.stringify(createDefinition(coordinates))
}

function createStore(data) {
  const blobServiceStub = {
    listBlobsSegmentedWithPrefix: sinon.stub().callsFake(async (container, name, continuation, metadata, callback) => {
      name = name.toLowerCase()
      if (name.includes('error')) return callback(new Error('test error'))
      callback(null, {
        continuationToken: null,
        entries: Object.keys(data)
          .map(key => (key.startsWith(name) ? data[key] : null))
          .filter(e => e)
      })
    }),
    createBlockBlobFromText: sinon.stub().callsFake(async (container, name, content, metadata, callback) => {
      if (name.includes('error')) return callback(new Error('test error'))
      callback()
    }),
    deleteBlob: sinon.stub().callsFake(async (container, name, callback) => {
      if (name.includes('error')) return callback(new Error('test error'))
      callback()
    }),
    getBlobToText: sinon.stub().callsFake(async (container, name, callback) => {
      if (name.includes('error')) return callback(new Error('test error'))
      name = name.toLowerCase()
      if (data[name]) return callback(null, data[name])
      const error = new Error('not found')
      error.code = 'BlobNotFound'
      callback(error)
    })
  }
  const store = Store({})
  store.blobService = blobServiceStub
  return store
}
