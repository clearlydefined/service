import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
// @ts-nocheck
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Curation from '../../../lib/curation.js'
import EntityCoordinates from '../../../lib/entityCoordinates.js'
import Store from '../../../providers/curation/mongoCurationStore.js'

const pr = {
  number: 12,
  head: { ref: 'master', sha: '32' },
  files: [{ filename: 'curations/npm/npmjs/-/foo.yaml' }],
  merged_at: '2018-11-13T02:44:34Z'
}

const curation = new Curation({
  coordinates: { type: 'npm', provider: 'npmjs', name: 'foo' },
  revisions: {
    '1.0': {
      described: { projectWebsite: 'http://foo.com' }
    }
  }
})

const files = [
  {
    coordinates: {
      name: 'foo',
      provider: 'npmjs',
      type: 'npm'
    },
    path: '',
    revisions: [
      {
        data: {
          described: {
            projectWebsite: 'http://foo.com'
          }
        },
        revision: '1.0'
      }
    ]
  }
]
describe('Mongo Curation store', () => {
  it('handles updateContribution for no curation', async () => {
    const service = createStore()
    await service.updateContribution(pr)
    assert.strictEqual(service.collection.updateOne.mock.callCount() === 1, true)
    assert.strictEqual(service.collection.replaceOne.mock.callCount() > 0, false)
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[0], { _id: 12 })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[1], { $set: { pr } })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[2], { upsert: true })
  })

  it('handles updateContribution for curation', async () => {
    const service = createStore()
    await service.updateContribution(pr, [curation])
    assert.strictEqual(service.collection.updateOne.mock.callCount() > 0, false)
    assert.strictEqual(service.collection.replaceOne.mock.callCount() === 1, true)
    assert.deepStrictEqual(service.collection.replaceOne.mock.calls[0].arguments[0], { _id: 12 })
    assert.deepStrictEqual(service.collection.replaceOne.mock.calls[0].arguments[1], { _id: 12, pr, files })
  })

  it('handles updateContribution for curation with no data', async () => {
    const service = createStore()
    await service.updateContribution(pr, [new Curation()])
    assert.strictEqual(service.collection.updateOne.mock.callCount() > 0, true)
    assert.strictEqual(service.collection.replaceOne.mock.callCount() === 1, false)
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[0], { _id: 12 })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[1], { $set: { pr } })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[2], { upsert: true })
  })

  it('handles updateContribution for curation with partial data', async () => {
    const service = createStore()
    await service.updateContribution(pr, [
      new Curation(),
      new Curation({
        coordinates: { type: 'npm', provider: 'npmjs', name: 'foo' },
        revisions: {
          '1.0': {
            described: { projectWebsite: 'http://foo.com' }
          }
        }
      })
    ])
    assert.strictEqual(service.collection.updateOne.mock.callCount() > 0, false)
    assert.strictEqual(service.collection.replaceOne.mock.callCount() === 1, true)
    assert.deepStrictEqual(service.collection.replaceOne.mock.calls[0].arguments[0], { _id: 12 })
    assert.deepStrictEqual(service.collection.replaceOne.mock.calls[0].arguments[1], { _id: 12, pr, files })
  })

  it('handles updateContribution for curation with data with no revisions', async () => {
    const service = createStore()
    await service.updateContribution(pr, [
      new Curation({
        coordinates: { type: 'npm', provider: 'npmjs', name: 'foo' }
      })
    ])
    assert.strictEqual(service.collection.updateOne.mock.callCount() > 0, true)
    assert.strictEqual(service.collection.replaceOne.mock.callCount() === 1, false)
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[0], { _id: 12 })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[1], { $set: { pr } })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[2], { upsert: true })
  })

  it('handles updateContribution for curation with data with no coordinates', async () => {
    const service = createStore()
    await service.updateContribution(pr, [
      new Curation({
        revisions: {
          '1.0': {
            described: { projectWebsite: 'http://foo.com' }
          }
        }
      })
    ])
    assert.strictEqual(service.collection.updateOne.mock.callCount() > 0, true)
    assert.strictEqual(service.collection.replaceOne.mock.callCount() === 1, false)
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[0], { _id: 12 })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[1], { $set: { pr } })
    assert.deepStrictEqual(service.collection.updateOne.mock.calls[0].arguments[2], { upsert: true })
  })

  it('updates curations', async () => {
    const service = createStore()
    await service.updateCurations([curation])
    assert.strictEqual(service.collection.replaceOne.mock.callCount() === 1, true)
    assert.deepStrictEqual(service.collection.replaceOne.mock.calls[0].arguments[0], { _id: 'npm/npmjs/-/foo' })
    assert.deepStrictEqual(service.collection.replaceOne.mock.calls[0].arguments[1], {
      _id: 'npm/npmjs/-/foo',
      ...curation.data
    })
    assert.deepStrictEqual(service.collection.replaceOne.mock.calls[0].arguments[2], { upsert: true })
  })

  it('gets contribution', async () => {
    const service = createStore()
    await service.getContribution(1)
    assert.strictEqual(service.collection.findOne.mock.callCount() === 1, true)
    assert.deepStrictEqual(service.collection.findOne.mock.calls[0].arguments[0], { _id: 1 })
  })

  it('lists by coordinates', async () => {
    const service = createStore()
    const result = await service.list(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
    assert.strictEqual(service.collection.find.mock.callCount() === 2, true)
    assert.deepStrictEqual(service.collection.find.mock.calls[0].arguments[0], { _id: /^npm\/npmjs\/-\/foo/ })
    assert.deepStrictEqual(service.collection.find.mock.calls[1].arguments[0], {
      'files.coordinates.type': 'npm',
      'files.coordinates.provider': 'npmjs',
      'files.coordinates.name': 'foo',
      'files.revisions.revision': '1.0'
    })
    assert.deepStrictEqual(service.collection.find().sort.mock.calls[0].arguments[0], { 'pr.number': -1 })
    assert.deepStrictEqual(result.curations, {
      'npm/npmjs/-/foo/1.0': { described: { projectWebsite: 'http://foo.com' } }
    })
  })

  it('handles list with no coordinates', async () => {
    const service = createStore()
    const result = await service.list(new EntityCoordinates())
    assert.strictEqual(result, null)

    await assert.rejects(service.list(), { message: 'must specify coordinates to list' })
  })
})

function createStore() {
  const collectionStub = {
    replaceOne: mock.fn(),
    updateOne: mock.fn(),
    findOne: mock.fn(),
    find: mock.fn(() => ({
      sort: mock.fn(() => ({ project: mock.fn(() => ({ toArray: () => Promise.resolve([]) })) })),
      project: mock.fn(() => ({ toArray: () => Promise.resolve([curation.data]) }))
    }))
  }
  const store = Store({})
  store.collection = collectionStub
  return store
}
