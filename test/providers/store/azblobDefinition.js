// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/azblobDefinitionStore')
const sinon = require('sinon')
const { expect } = require('chai')
const EntityCoordinates = require('../../../lib/entityCoordinates')

// Initialize logger for tests
const loggerFactory = require('../../../providers/logging/logger')
try {
  loggerFactory({ info: () => {}, error: () => {}, warn: () => {}, debug: () => {} })
} catch {
  // Logger already initialized
}

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
    expect(result).to.deep.equalInAnyOrder(['npm/npmjs/-/co/4.6.0'])
  })

  it('should list coordinates preserving case from blob metadata', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
    expect(result).to.deep.equalInAnyOrder(['npm/npmjs/-/Co/4.6.1'])
  })

  it('list coordinates with partial coordinates', async () => {
    const data = {
      'npm/npmjs/-/co/revision/4.6.0.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.0' } },
      'npm/npmjs/-/co/revision/4.6.1.json': { metadata: { id: 'npm/npmjs/-/Co/4.6.1' } }
    }
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co'))
    expect(result).to.deep.equalInAnyOrder(['npm/npmjs/-/Co/4.6.0', 'npm/npmjs/-/Co/4.6.1'])
  })

  it('stores a definition', async () => {
    const definition = createDefinition('npm/npmjs/-/foo/1.0')
    const store = createStore()
    await store.store(definition)
    expect(store._uploadStub.callCount).to.eq(1)
    expect(store._uploadBlobName).to.eq('npm/npmjs/-/foo/revision/1.0.json')
  })

  it('deletes a definition', async () => {
    const store = createStore()
    await store.delete(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
    expect(store._deleteStub.callCount).to.eq(1)
    expect(store._deleteBlobName).to.eq('npm/npmjs/-/foo/revision/1.0.json')
  })

  it('does not throw deleting missing definition', async () => {
    const store = createStore()
    await store.delete(EntityCoordinates.fromString('npm/npmjs/-/missing/1.0'))
    expect(store._deleteStub.callCount).to.eq(1)
    expect(store._deleteBlobName).to.eq('npm/npmjs/-/missing/revision/1.0.json')
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

function createStore(data = {}) {
  const store = Store({})

  // Track blob names for assertions
  store._uploadBlobName = null
  store._deleteBlobName = null

  // Create stubs
  store._uploadStub = sinon.stub().resolves()
  store._deleteStub = sinon.stub().callsFake(async () => {
    const blobName = store._deleteBlobName
    if (blobName && blobName.includes('error')) throw new Error('test error')
    if (blobName && blobName.includes('missing')) {
      const error = new Error('not found')
      error.statusCode = 404
      throw error
    }
  })

  // Create async iterator for listBlobsFlat
  const createAsyncIterator = prefix => {
    const prefixLower = prefix.toLowerCase()
    const matchingBlobs = Object.keys(data)
      .filter(key => key.toLowerCase().startsWith(prefixLower))
      .map(key => ({ name: key, metadata: data[key].metadata }))

    if (prefixLower.includes('error')) {
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(new Error('test error'))
            }
          }
        }
      }
    }

    return {
      async *[Symbol.asyncIterator]() {
        for (const blob of matchingBlobs) {
          yield blob
        }
      }
    }
  }

  // Mock containerClient
  store.containerClient = {
    listBlobsFlat: sinon.stub().callsFake(options => createAsyncIterator(options.prefix)),
    getBlockBlobClient: sinon.stub().callsFake(blobName => {
      store._uploadBlobName = blobName
      return {
        upload: store._uploadStub
      }
    }),
    getBlobClient: sinon.stub().callsFake(blobName => {
      store._deleteBlobName = blobName
      const blobNameLower = blobName.toLowerCase()
      return {
        delete: store._deleteStub,
        download: sinon.stub().callsFake(async () => {
          if (blobName.includes('error')) throw new Error('test error')
          if (data[blobNameLower]) {
            const content =
              typeof data[blobNameLower] === 'string' ? data[blobNameLower] : JSON.stringify(data[blobNameLower])
            return { readableStreamBody: createReadableStream(content) }
          }
          const error = new Error('not found')
          error.statusCode = 404
          throw error
        })
      }
    })
  }

  return store
}

function createReadableStream(content) {
  const { Readable } = require('stream')
  return Readable.from([Buffer.from(content)])
}
