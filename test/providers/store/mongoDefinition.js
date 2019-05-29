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
    expect(store.collection.deleteMany.args[0][0]['_mongo.partitionKey']).to.eq('npm/npmjs/-/foo/1.0')
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

  it('builds a mongo query', () => {
    const store = createStore()
    const data = new Map([
      [{}, { '_mongo.page': 1 }],
      [{ type: 'npm' }, { '_mongo.page': 1, 'coordinates.type': 'npm' }],
      [{ provider: 'npmjs' }, { '_mongo.page': 1, 'coordinates.provider': 'npmjs' }],
      [{ name: 'package' }, { '_mongo.page': 1, 'coordinates.name': 'package' }],
      [
        { namespace: '@owner', name: 'package' },
        { '_mongo.page': 1, 'coordinates.name': 'package', 'coordinates.namespace': '@owner' }
      ],
      [{ license: 'MIT' }, { '_mongo.page': 1, 'licensed.declared': 'MIT' }],
      [{ releasedAfter: '2018-01-01' }, { '_mongo.page': 1, 'described.releaseDate': { $gt: '2018-01-01' } }],
      [{ releasedBefore: '2017-12-30' }, { '_mongo.page': 1, 'described.releaseDate': { $lt: '2017-12-30' } }],
      [{ minLicensedScore: 50 }, { '_mongo.page': 1, 'licensed.score.total': { $gt: 50 } }],
      [{ maxLicensedScore: 50 }, { '_mongo.page': 1, 'licensed.score.total': { $lt: 50 } }],
      [{ minDescribedScore: 50 }, { '_mongo.page': 1, 'described.score.total': { $gt: 50 } }],
      [{ maxDescribedScore: 50 }, { '_mongo.page': 1, 'described.score.total': { $lt: 50 } }],
      [{ minEffectiveScore: 50 }, { '_mongo.page': 1, 'scores.effective': { $gt: 50 } }],
      [{ maxEffectiveScore: 50 }, { '_mongo.page': 1, 'scores.effective': { $lt: 50 } }],
      [{ minToolScore: 50 }, { '_mongo.page': 1, 'scores.tool': { $gt: 50 } }],
      [{ maxToolScore: 50 }, { '_mongo.page': 1, 'scores.tool': { $lt: 50 } }]
    ])
    data.forEach((expected, input) => {
      expect(store._buildQuery(input)).to.deep.equal(expected)
    })
  })

  it('builds a mongo query with continuationToken', () => {
    const store = createStore()
    const parameters = { namespace: '@owner', name: 'package' }
    const continuationToken = 'bnBtL25wbWpzLy0vdmVycm9yLzEuMTAuMA'
    const expected = {
      '_mongo.page': 1,
      'coordinates.name': 'package',
      'coordinates.namespace': '@owner',
      '_mongo.partitionKey': { $gt: 'npm/npmjs/-/verror/1.10.0' }
    }
    expect(store._buildQuery(parameters, continuationToken)).to.deep.equal(expected)
  })

  it('builds a mongo sort', () => {
    const store = createStore()
    const data = new Map([
      [{}, { '_mongo.partitionKey': 1 }],
      [{ sort: 'type' }, { 'coordinates.type': 1 }],
      [{ sort: 'provider' }, { 'coordinates.provider': 1 }],
      [{ sort: 'name', sortDesc: true }, { 'coordinates.name': -1, 'coordinates.revision': -1 }],
      [{ sort: 'namespace' }, { 'coordinates.namespace': 1, 'coordinates.name': 1, 'coordinates.revision': 1 }],
      [{ sort: 'license', sortDesc: true }, { 'licensed.declared': -1 }],
      [{ sort: 'releaseDate' }, { 'described.releaseDate': 1 }],
      [{ sort: 'licensedScore', sortDesc: false }, { 'licensed.score.total': 1 }],
      [{ sort: 'describedScore' }, { 'described.score.total': 1 }],
      [{ sort: 'effectiveScore' }, { 'scores.effective': 1 }],
      [{ sort: 'toolScore' }, { 'scores.tool': 1 }],
      [{ sort: 'revision' }, { 'coordinates.revision': 1 }]
    ])
    data.forEach((expected, input) => {
      const result = store._buildSort(input)
      expect(result).to.deep.equal(expected)
      expect(Object.keys(result)).to.have.ordered.members(Object.keys(expected))
    })
  })

  it('gets a continuationToken', () => {
    const store = createStore()
    const token = store._getContinuationToken(5, [
      { _mongo: { partitionKey: 'npm/npmjs/-/a/1.0.0' } },
      { _mongo: { partitionKey: 'npm/npmjs/-/b/1.0.0' } },
      { _mongo: { partitionKey: 'npm/npmjs/-/c/1.0.0' } },
      { _mongo: { partitionKey: 'npm/npmjs/-/d/1.0.0' } },
      { _mongo: { partitionKey: 'npm/npmjs/-/e/1.0.0' } }
    ])
    expect(token).to.eq('bnBtL25wbWpzLy0vZS8xLjAuMA==')
  })

  it('does not get a continuationToken', () => {
    const store = createStore()
    const token = store._getContinuationToken(5, [
      { _mongo: { partitionKey: 'npm/npmjs/-/a/1.0.0' } },
      { _mongo: { partitionKey: 'npm/npmjs/-/b/1.0.0' } },
      { _mongo: { partitionKey: 'npm/npmjs/-/c/1.0.0' } }
    ])
    expect(token).to.eq('')
  })
})

function createDefinition(coordinates) {
  coordinates = EntityCoordinates.fromString(coordinates)
  return { coordinates, _id: coordinates.toString(), '_mongo.partitionKey': coordinates.toString() }
}

function createStore(data) {
  const collectionStub = {
    find: sinon.stub().callsFake(async filter => {
      const partitionKey = filter['_mongo.partitionKey']
      if (partitionKey && partitionKey.toString().includes('error')) throw new Error('test error')
      // return an object that mimics a Mongo cursor (i.e., has toArray)
      return {
        toArray: () => {
          const result =
            typeof partitionKey === 'string'
              ? Object.keys(data).map(key => (key.indexOf(partitionKey) > -1 ? data[key] : null))
              : Object.keys(data).map(key => (partitionKey.exec(key) ? data[key] : null))
          return result.filter(e => e)
        },
        forEach: cb => {
          Object.keys(data).forEach(key => {
            if (typeof partitionKey === 'string' && key.indexOf(partitionKey) > -1) cb(data[key])
            else if (partitionKey.exec && partitionKey.exec(key)) cb(data[key])
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
