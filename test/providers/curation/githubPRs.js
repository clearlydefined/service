// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const CurationStore = require('../../../providers/curation/memoryStore')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const sandbox = sinon.createSandbox()
const yaml = require('js-yaml')
const base64 = require('base-64')
const EntityCoordinates = require('../../../lib/entityCoordinates')

const curationCoordinates = { type: 'npm', provider: 'npmjs', name: 'test' }

function complexCuration(name = 'foo') {
  return {
    coordinates: { ...curationCoordinates, name },
    revisions: {
      '1.0': {
        described: { releaseDate: '2018-10-19', projectWebsite: `http://${name}.com` },
        files: [{ path: `${name}.1.txt`, license: 'MIT' }, { path: `${name}.2.txt`, license: 'GPL' }]
      }
    }
  }
}

const files = {
  'curations/npm/npmjs/-/foo.yaml': { sha: 42, content: complexCuration('foo') },
  'curations/npm/npmjs/-/bar.yaml': { sha: 52, content: complexCuration('bar') }
}

const prs = {
  12: { number: 12, head: { ref: 'master', sha: '32' }, files: [{ filename: 'curations/npm/npmjs/-/foo.yaml' }] },
  13: {
    number: 13,
    head: { ref: 'master', sha: '72' },
    files: [{ filename: 'curations/npm/npmjs/-/foo.yaml' }, { filename: 'curations/npm/npmjs/-/bar.yaml' }]
  }
}

const defaultCurations = {
  'npm/npmjs/-/test': complexCuration()
}

let Service
describe('Curation service pr events', () => {
  beforeEach(function() {
    const requestStub = () => {
      return Promise.resolve({ statusCode: 200 })
    }
    Service = proxyquire('../../../providers/curation/github', { 'request-promise-native': requestStub })
  })

  afterEach(function() {
    sandbox.restore()
  })

  it('handles open', async () => {
    const service = createService()
    await service.prOpened(prs[12])
    const updateSpy = service.store.updateContribution
    expect(updateSpy.calledOnce).to.be.true
    expect(updateSpy.args[0][0].number).to.be.equal(12)
    const data = updateSpy.args[0][1].map(curation => curation.data)
    expect(data).to.be.deep.equalInAnyOrder([complexCuration()])
  })

  it('handles update', async () => {
    const service = createService()
    await service.prUpdated(prs[12])
    const updateSpy = service.store.updateContribution
    expect(updateSpy.calledOnce).to.be.true
    expect(updateSpy.args[0][0].number).to.be.equal(12)
    const data = updateSpy.args[0][1].map(curation => curation.data)
    expect(data).to.be.deep.equalInAnyOrder([complexCuration()])
  })

  it('handles merge', async () => {
    const service = createService()
    await service.prMerged(prs[12])

    const updateSpy = service.store.updateContribution
    expect(updateSpy.calledOnce).to.be.true
    expect(updateSpy.args[0][0].number).to.be.equal(12)
    expect(updateSpy.args[0][1]).to.be.undefined

    const curationSpy = service.store.updateCurations
    expect(curationSpy.calledOnce).to.be.true
    const curations = curationSpy.args[0][0].map(curation => curation.data)
    expect(curations).to.be.deep.equalInAnyOrder([complexCuration()])

    const invalidateSpy = service.definitionService.invalidate
    expect(invalidateSpy.calledOnce).to.be.true
    expect(invalidateSpy.args[0][0]).to.be.deep.equalInAnyOrder([{ ...complexCuration().coordinates, revision: '1.0' }])

    const computeSpy = service.definitionService.computeAndStore
    expect(computeSpy.calledOnce).to.be.true
    expect(computeSpy.args[0][0]).to.be.deep.equal({ ...complexCuration().coordinates, revision: '1.0' })
  })

  it('handles close', async () => {
    const service = createService()
    await service.prClosed(prs[12])
    const updateSpy = service.store.updateContribution
    expect(updateSpy.calledOnce).to.be.true
    expect(updateSpy.args[0][0].number).to.be.equal(12)
  })

  it('handles list', async () => {
    const service = createService()
    service.store.curations = defaultCurations
    const list = await service.list(EntityCoordinates.fromString('npm/npmjs'))
    const listSpy = service.store.list
    expect(listSpy.calledOnce).to.be.true
    expect(list).to.be.deep.equalInAnyOrder([complexCuration()])
  })

  it('handles failure to compute one definition of multiple', async () => {
    const service = createService()
    await service.prMerged(prs[13])

    const updateSpy = service.store.updateContribution
    expect(updateSpy.calledOnce).to.be.true
    expect(updateSpy.args[0][0].number).to.be.equal(13)
    expect(updateSpy.args[0][1]).to.be.undefined

    const curationSpy = service.store.updateCurations
    expect(curationSpy.calledOnce).to.be.true
    const curations = curationSpy.args[0][0].map(curation => curation.data)
    expect(curations).to.be.deep.equalInAnyOrder([complexCuration('foo'), complexCuration('bar')])

    const invalidateSpy = service.definitionService.invalidate
    expect(invalidateSpy.calledOnce).to.be.true
    expect(invalidateSpy.args[0][0]).to.be.deep.equalInAnyOrder([
      { ...complexCuration('foo').coordinates, revision: '1.0' },
      { ...complexCuration('bar').coordinates, revision: '1.0' }
    ])

    const computeSpy = service.definitionService.computeAndStore
    expect(computeSpy.calledTwice).to.be.true
    expect(computeSpy.args[0][0]).to.be.deep.equal({ ...complexCuration('foo').coordinates, revision: '1.0' })
  })
})

function createService(failsCompute = false) {
  const store = CurationStore({})
  sinon.spy(store, 'updateContribution')
  sinon.spy(store, 'updateCurations')
  sinon.spy(store, 'list')
  const definitionService = {
    invalidate: sinon.stub(),
    computeAndStore: sinon.stub().callsFake(() => (failsCompute ? Promise.reject('error') : Promise.resolve(null)))
  }
  const service = Service(
    { owner: 'foobar', repo: 'foobar', branch: 'foobar', token: 'foobar' },
    store,
    { website: 'http://localhost:3000' },
    definitionService
  )
  service.github = {
    pullRequests: {
      getFiles: ({ number }) => {
        return { data: prs[number].files }
      },
      get: ({ number }) => {
        return { data: { head: prs[number].head } }
      }
    },
    repos: {
      createStatus: sinon.stub(),
      getContent: ({ path }) => {
        return {
          data: {
            sha: files[path].sha,
            content: base64.encode(yaml.safeDump(files[path].content, { sortKeys: true, lineWidth: 150 }))
          }
        }
      }
    }
  }
  return service
}
