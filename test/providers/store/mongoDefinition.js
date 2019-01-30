// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/mongo')
const sinon = require('sinon')
const { expect } = require('chai')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const { range } = require('lodash')

describe('Mongo Definition store', () => {
  const data = {
    'npm/npmjs/-/co/4.6.0': createDefinition('npm/npmjs/-/Co/4.6.0'),
    'npm/npmjs/-/co/4.6.1': createDefinition('npm/npmjs/-/Co/4.6.1')
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
    expect(store.collection.deleteMany.callCount).to.eq(1)
    expect(store.collection.deleteMany.args[0][0]['_mongo.partitionKey']).to.eq('npm/npmjs/-/foo/1.0')
    expect(store.collection.insertMany.callCount).to.eq(1)
    expect(store.collection.insertMany.args[0][0][0]._id).to.eq('npm/npmjs/-/foo/1.0')
    expect(store.collection.insertMany.args[0][0][0]._mongo.page).to.eq(1)
    expect(store.collection.insertMany.args[0][0][0]._mongo.totalPages).to.eq(1)
  })

  it('stores a paged definition', async () => {
    const definition = createDefinition('npm/npmjs/-/foo/1.0')
    definition.files = range(0, 1500).map(x => {
      return { path: `/path/to/${x}.txt` }
    })
    const store = createStore()
    await store.store(definition)
    expect(store.collection.deleteMany.callCount).to.eq(1)
    expect(store.collection.deleteMany.args[0][0]['_mongo.partitionKey']).to.eq('npm/npmjs/-/foo/1.0')
    expect(store.collection.insertMany.callCount).to.eq(1)
    expect(store.collection.insertMany.args[0][0][0]._id).to.eq('npm/npmjs/-/foo/1.0')
    expect(store.collection.insertMany.args[0][0][0].files.length).to.eq(1000)
    expect(store.collection.insertMany.args[0][0][0]._mongo.page).to.eq(1)
    expect(store.collection.insertMany.args[0][0][0]._mongo.totalPages).to.eq(2)
    expect(store.collection.insertMany.args[0][0][1]._id).to.eq('npm/npmjs/-/foo/1.0/1')
    expect(store.collection.insertMany.args[0][0][1].files.length).to.eq(500)
    expect(store.collection.insertMany.args[0][0][1]._mongo.page).to.eq(2)
    expect(store.collection.insertMany.args[0][0][1]._mongo.totalPages).to.eq(2)
  })

  it('deletes a definition', async () => {
    const store = createStore()
    await store.delete(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
    expect(store.collection.deleteMany.callCount).to.eq(1)
    expect(store.collection.deleteMany.args[0][0]._id).to.deep.eq(/^npm\/npmjs\/-\/foo\/1.0(\/.+)?$/)
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
  coordinates = EntityCoordinates.fromString(coordinates)
  return { coordinates, _id: coordinates.toString(), '_mongo.partitionKey': coordinates.toString() }
}

function createStore(data) {
  const collectionStub = {
    find: sinon.stub().callsFake(async filter => {
      const regex = filter._id
      const partitionKey = filter['_mongo.partitionKey']
      if (regex && regex.toString().includes('error')) throw new Error('test error')
      if (partitionKey && partitionKey.includes('error')) throw new Error('test error')
      // return an object that mimics a Mongo cursor (i.e., has toArray)
      return {
        toArray: () => {
          const result = partitionKey
            ? Object.keys(data).map(key => (key.indexOf(partitionKey) > -1 ? data[key] : null))
            : Object.keys(data).map(key => (regex.exec(key) ? data[key] : null))
          return result.filter(e => e)
        },
        forEach: cb => {
          Object.keys(data).forEach(key => {
            if (regex && regex.exec(key)) cb(data[key])
            if (partitionKey && key.indexOf(partitionKey) > -1) cb(data[key])
          })
        }
      }
    }),
    insertMany: sinon.stub(),
    deleteMany: sinon.stub()
  }
  const store = Store({})
  store.collection = collectionStub
  return store
}
