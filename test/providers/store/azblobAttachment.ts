import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Store from '../../../providers/stores/azblobAttachmentStore.js'

describe('AzureAttachmentStore list definitions', () => {
  it('throws original error when not ENOENT', async () => {
    const store = createStore()
    try {
      await store.get('error')
      throw new Error('should have thrown error')
    } catch (error) {
      assert.strictEqual(error.message, 'test error')
    }
  })

  it('works for unknown key', async () => {
    const store = createStore()
    const result = await store.get('44')
    assert.strictEqual(result, null)
  })

  it('gets an attachment', async () => {
    const store = createStore()
    const result = await store.get('42')
    assert.strictEqual(result, '42 attachment')
  })
})

const data = {
  'attachment/42.json': JSON.stringify({ attachment: '42 attachment' }),
  'attachment/4.json': JSON.stringify({ attachment: '4 attachment' }),
  'attachment/1.json': JSON.stringify({ attachment: '1 attachment' })
}

function createStore() {
  const blobServiceStub = {
    getBlobToText: mock.fn((_container, path, cb) => {
      if (path.includes('error')) {
        return cb(new Error('test error'))
      }
      if (data[path]) {
        return cb(null, data[path])
      }
      const error = new Error('not found') as Error & { statusCode: number }
      error.statusCode = 404
      cb(error)
    })
  }
  const store = (Store as (...args: any[]) => any)({})
  store.blobService = blobServiceStub
  return store
}
