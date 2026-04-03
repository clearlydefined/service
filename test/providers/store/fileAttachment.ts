import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
let FileStore

const data = {
  '/foo/42.json': JSON.stringify({ attachment: '42 attachment' }),
  '/foo/4.json': JSON.stringify({ attachment: '4 attachment' }),
  '/foo/1.json': JSON.stringify({ attachment: '1 attachment' })
}

describe('FileAttachmentStore list definitions', () => {
  before(() => {
    const fsStub = {
      readFile: (path, cb) => {
        path = path.replace(/\\/g, '/')
        if (path.includes('error')) {
          return cb(new Error('test error'))
        }
        if (data[path]) {
          return cb(null, data[path])
        }
        const error = new Error('not found') as Error & { code: string }
        error.code = 'ENOENT'
        cb(error)
      }
    }
    FileStore = proxyquire('../../../providers/stores/fileAttachmentStore', { 'node:fs': fsStub })
  })

  after(() => {})

  it('throws original error when not ENOENT', async () => {
    const fileStore = FileStore({ location: '/foo' })
    try {
      await fileStore.get('error')
      throw new Error('should have thrown error')
    } catch (error) {
      assert.strictEqual(error.message, 'test error')
    }
  })

  it('works for unknown key', async () => {
    const fileStore = FileStore({ location: '/foo' })
    const result = await fileStore.get('44')
    assert.strictEqual(result, null)
  })

  it('gets an attachment', async () => {
    const fileStore = FileStore({ location: '/foo' })
    const result = await fileStore.get('42')
    assert.strictEqual(result, '42 attachment')
  })
})
