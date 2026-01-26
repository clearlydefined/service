// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const { expect } = require('chai')
const Store = require('../../../providers/stores/azblobAttachmentStore')

// Initialize logger for tests
const loggerFactory = require('../../../providers/logging/logger')
try {
  loggerFactory({ info: () => {}, error: () => {}, warn: () => {}, debug: () => {} })
} catch {
  // Logger already initialized
}

describe('AzureAttachmentStore list definitions', () => {
  it('throws original error when not ENOENT', async () => {
    const store = createStore()
    try {
      await store.get('error')
      throw new Error('should have thrown error')
    } catch (error) {
      expect(error.message).to.eq('test error')
    }
  })

  it('works for unknown key', async () => {
    const store = createStore()
    const result = await store.get('44')
    expect(result).to.be.null
  })

  it('gets an attachment', async () => {
    const store = createStore()
    const result = await store.get('42')
    expect(result).to.eq('42 attachment')
  })
})

const data = {
  'attachment/42.json': JSON.stringify({ attachment: '42 attachment' }),
  'attachment/4.json': JSON.stringify({ attachment: '4 attachment' }),
  'attachment/1.json': JSON.stringify({ attachment: '1 attachment' })
}

function createStore() {
  const store = Store({})

  // Mock containerClient
  store.containerClient = {
    getBlobClient: sinon.stub().callsFake(path => ({
      download: sinon.stub().callsFake(async () => {
        if (path.includes('error')) throw new Error('test error')
        if (data[path]) {
          return { readableStreamBody: createReadableStream(data[path]) }
        }
        const error = new Error('not found')
        error.statusCode = 404
        throw error
      })
    }))
  }

  return store
}

function createReadableStream(content) {
  const { Readable } = require('stream')
  return Readable.from([Buffer.from(content)])
}
