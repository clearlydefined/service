import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { assertDeepEqualInAnyOrder } from '../../helpers/assert.ts'
// @ts-nocheck
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import EntityCoordinates from '../../../lib/entityCoordinates.js'
import Store from '../../../providers/stores/azblobDefinitionStore.js'

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
      assert.strictEqual(error.message, 'test error')
    }
  })

  it('should list no coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/bogus/4.6.0'))
    assert.strictEqual(result.length, 0)
  })

  it('should list one coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.0'))
    assertDeepEqualInAnyOrder(result, ['npm/npmjs/-/co/4.6.0'])
  })

  it('should list coordinates preserving case from blob metadata', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
    assertDeepEqualInAnyOrder(result, ['npm/npmjs/-/Co/4.6.1'])
  })

  it('list coordinates with partial coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co'))
    assertDeepEqualInAnyOrder(result, ['npm/npmjs/-/Co/4.6.0', 'npm/npmjs/-/Co/4.6.1'])
  })

  it('stores a definition', async () => {
    const definition = createDefinition('npm/npmjs/-/foo/1.0')
    const store = createStore()
    await store.store(definition)
    assert.strictEqual(store.blobService.createBlockBlobFromText.mock.callCount(), 1)
    assert.strictEqual(
      store.blobService.createBlockBlobFromText.mock.calls[0].arguments[1],
      'npm/npmjs/-/foo/revision/1.0.json'
    )
  })

  it('deletes a definition', async () => {
    const store = createStore()
    await store.delete(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
    assert.strictEqual(store.blobService.deleteBlob.mock.callCount(), 1)
    assert.strictEqual(store.blobService.deleteBlob.mock.calls[0].arguments[1], 'npm/npmjs/-/foo/revision/1.0.json')
  })

  it('does not throw deleting missing definition', async () => {
    const store = createStore()
    await store.delete(EntityCoordinates.fromString('npm/npmjs/-/missing/1.0'))
    assert.strictEqual(store.blobService.deleteBlob.mock.callCount(), 1)
    assert.strictEqual(store.blobService.deleteBlob.mock.calls[0].arguments[1], 'npm/npmjs/-/missing/revision/1.0.json')
  })

  it('gets a definition', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': createDefinitionJson('npm/npmjs/-/co/4.6.0'),
      'npm/npmjs/-/co/revision/4.6.1.json': createDefinitionJson('npm/npmjs/-/co/4.6.1'),
      'npm/npmjs/-/co/revision/4.6.2.json': createDefinitionJson('npm/npmjs/-/co/4.6.2')
    }
    const store = createStore(data)
    const result = await store.get(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
    assert.deepStrictEqual(result.coordinates, EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
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
    listBlobsSegmentedWithPrefix: mock.fn(async (_container, name, _continuation, _metadata, callback) => {
      name = name.toLowerCase()
      if (name.includes('error')) {
        return callback(new Error('test error'))
      }
      callback(null, {
        continuationToken: null,
        entries: Object.keys(data)
          .map(key => (key.startsWith(name) ? data[key] : null))
          .filter(e => e)
      })
    }),
    createBlockBlobFromText: mock.fn(async (_container, name, _content, _metadata, callback) => {
      if (name.includes('error')) {
        return callback(new Error('test error'))
      }
      callback()
    }),
    deleteBlob: mock.fn(async (_container, name, callback) => {
      if (name.includes('error')) {
        return callback(new Error('test error'))
      }
      if (name.includes('missing')) {
        return callback({ code: 'BlobNotFound' })
      }
      callback()
    }),
    getBlobToText: mock.fn(async (_container, name, callback) => {
      if (name.includes('error')) {
        return callback(new Error('test error'))
      }
      name = name.toLowerCase()
      if (data[name]) {
        return callback(null, data[name])
      }
      const error = new Error('not found')
      error.code = 'BlobNotFound'
      callback(error)
    })
  }
  const store = Store({})
  store.blobService = blobServiceStub
  return store
}
