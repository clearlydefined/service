// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/mongo')
const sinon = require('sinon')
const { expect } = require('chai')
const EntityCoordinates = require('../../../lib/entityCoordinates')

describe('Mongo Definition store', () => {
  const data = {
    'npm/npmjs/-/co/4.6.0': { id: 'npm/npmjs/-/Co/4.6.0' },
    'npm/npmjs/-/co/4.6.1': { id: 'npm/npmjs/-/Co/4.6.1' }
  }

  it('throws original error', async () => {
    const store = createStore(data)
    try {
      await store.list(EntityCoordinates.fromString('npm/npmjs/-/error/4.6.0'))
      throw new Error('should have thrown error')
    } catch (error) {
      expect(error.message).to.eq('test error')
    }
  })

  it('should list no coordinates', async () => {
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/bogus/4.6.0'))
    expect(result.length).to.eq(0)
  })

  it('should list one coordinates', async () => {
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.0'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/Co/4.6.0'])
  })

  it('should list coordinates preserving case', async () => {
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/CO/4.6.1'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/Co/4.6.1'])
  })

  it('list coordinates with partial coordinates', async () => {
    const store = createStore(data)
    const result = await store.list(EntityCoordinates.fromString('npm/npmjs/-/co'))
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/Co/4.6.0', 'npm/npmjs/-/Co/4.6.1'])
  })

  it('stores a definition', async () => {
    const definition = createDefinition('npm/npmjs/-/foo/1.0')
    const store = createStore()
    await store.store(definition)
    expect(store.collection.replaceOne.callCount).to.eq(1)
    expect(store.collection.replaceOne.args[0][0].id).to.eq('npm/npmjs/-/foo/1.0')
  })

  it('deletes a definition', async () => {
    const store = createStore()
    await store.delete(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
    expect(store.collection.deleteOne.callCount).to.eq(1)
    expect(store.collection.deleteOne.args[0][0].id).to.eq('npm/npmjs/-/foo/1.0')
  })

  it('gets a definition', async () => {
    const data = {
      'npm/npmjs/-/co/4.6.0': createDefinition('npm/npmjs/-/co/4.6.0'),
      'npm/npmjs/-/co/4.6.1': createDefinition('npm/npmjs/-/co/4.6.1'),
      'npm/npmjs/-/co/4.6.2': createDefinition('npm/npmjs/-/co/4.6.2')
    }
    const store = createStore(data)
    const result = await store.get(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
    expect(result.coordinates).to.deep.eq(EntityCoordinates.fromString('npm/npmjs/-/co/4.6.1'))
  })
})

function createDefinition(coordinates) {
  return { coordinates: EntityCoordinates.fromString(coordinates) }
}

function createStore(data) {
  const collectionStub = {
    find: sinon.stub().callsFake(async (filter, projection) => {
      const regex = filter.id
      if (regex.toString().includes('error')) throw new Error('test error')
      return Object.keys(data)
        .map(key => (regex.exec(key) ? data[key] : null))
        .filter(e => e)
    }),
    findOne: sinon.stub().callsFake(async (filter, projection) => {
      name = filter.id
      if (name.includes('error')) throw new Error('test error')
      if (data[name]) return data[name]
      throw new Error('not found')
    }),
    replaceOne: sinon.stub(),
    deleteOne: sinon.stub()
  }
  const store = Store({})
  store.collection = collectionStub
  return store
}
