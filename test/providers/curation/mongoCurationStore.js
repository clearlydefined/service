// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/curation/mongoCurationStore')
const Curation = require('../../../lib/curation')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const sinon = require('sinon')
const { expect } = require('chai')

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
    expect(service.collection.updateOne.calledOnce).to.be.true
    expect(service.collection.replaceOne.called).to.be.false
    expect(service.collection.updateOne.args[0][0]).to.deep.eq({ _id: 12 })
    expect(service.collection.updateOne.args[0][1]).to.deep.eq({ $set: { pr } })
    expect(service.collection.updateOne.args[0][2]).to.deep.eq({ upsert: true })
  })

  it('handles updateContribution for curation', async () => {
    const service = createStore()
    await service.updateContribution(pr, [curation])
    expect(service.collection.updateOne.called).to.be.false
    expect(service.collection.replaceOne.calledOnce).to.be.true
    expect(service.collection.replaceOne.args[0][0]).to.deep.eq({ _id: 12 })
    expect(service.collection.replaceOne.args[0][1]).to.deep.eq({ _id: 12, pr, files })
  })

  it('handles updateContribution for curation with no data', async () => {
    const service = createStore()
    await service.updateContribution(pr, [new Curation()])
    expect(service.collection.updateOne.called).to.be.true
    expect(service.collection.replaceOne.calledOnce).to.be.false
    expect(service.collection.updateOne.args[0][0]).to.deep.eq({ _id: 12 })
    expect(service.collection.updateOne.args[0][1]).to.deep.eq({ $set: { pr } })
    expect(service.collection.updateOne.args[0][2]).to.deep.eq({ upsert: true })
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
    expect(service.collection.updateOne.called).to.be.false
    expect(service.collection.replaceOne.calledOnce).to.be.true
    expect(service.collection.replaceOne.args[0][0]).to.deep.eq({ _id: 12 })
    expect(service.collection.replaceOne.args[0][1]).to.deep.eq({ _id: 12, pr, files })
  })

  it('handles updateContribution for curation with data with no revisions', async () => {
    const service = createStore()
    await service.updateContribution(pr, [
      new Curation({
        coordinates: { type: 'npm', provider: 'npmjs', name: 'foo' }
      })
    ])
    expect(service.collection.updateOne.called).to.be.true
    expect(service.collection.replaceOne.calledOnce).to.be.false
    expect(service.collection.updateOne.args[0][0]).to.deep.eq({ _id: 12 })
    expect(service.collection.updateOne.args[0][1]).to.deep.eq({ $set: { pr } })
    expect(service.collection.updateOne.args[0][2]).to.deep.eq({ upsert: true })
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
    expect(service.collection.updateOne.called).to.be.true
    expect(service.collection.replaceOne.calledOnce).to.be.false
    expect(service.collection.updateOne.args[0][0]).to.deep.eq({ _id: 12 })
    expect(service.collection.updateOne.args[0][1]).to.deep.eq({ $set: { pr } })
    expect(service.collection.updateOne.args[0][2]).to.deep.eq({ upsert: true })
  })

  it('updates curations', async () => {
    const service = createStore()
    await service.updateCurations([curation])
    expect(service.collection.replaceOne.calledOnce).to.be.true
    expect(service.collection.replaceOne.args[0][0]).to.deep.eq({ _id: 'npm/npmjs/-/foo' })
    expect(service.collection.replaceOne.args[0][1]).to.deep.eq({ _id: 'npm/npmjs/-/foo', ...curation.data })
    expect(service.collection.replaceOne.args[0][2]).to.deep.eq({ upsert: true })
  })

  it('gets contribution', async () => {
    const service = createStore()
    await service.getContribution(1)
    expect(service.collection.findOne.calledOnce).to.be.true
    expect(service.collection.findOne.args[0][0]).to.deep.eq({ _id: 1 })
  })

  it('lists by coordinates', async () => {
    const service = createStore()
    const result = await service.list(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
    expect(service.collection.find.calledTwice).to.be.true
    expect(service.collection.find.args[0][0]).to.deep.eq({ _id: new RegExp('^npm/npmjs/-/foo') })
    expect(service.collection.find.args[1][0]).to.deep.eq({
      'files.coordinates.type': 'npm',
      'files.coordinates.provider': 'npmjs',
      'files.coordinates.name': 'foo',
      'files.revisions.revision': '1.0'
    })
    expect(service.collection.find().sort.args[0][0]).to.deep.eq({ 'pr.number': -1 })
    expect(result.curations).to.deep.eq({ 'npm/npmjs/-/foo/1.0': { described: { projectWebsite: 'http://foo.com' } } })
  })
})

function createStore() {
  const collectionStub = {
    replaceOne: sinon.stub(),
    updateOne: sinon.stub(),
    findOne: sinon.stub(),
    find: sinon.stub().returns({
      sort: sinon.stub().returns({ project: sinon.stub().returns({ toArray: () => Promise.resolve([]) }) }),
      project: sinon.stub().returns({ toArray: () => Promise.resolve([curation.data]) })
    })
  }
  const store = Store({})
  store.collection = collectionStub
  return store
}
