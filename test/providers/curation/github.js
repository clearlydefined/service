// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const GitHubCurationService = require('../../../providers/curation/github')
const DefinitionService = require('../../../business/definitionService')
const CurationStore = require('../../../providers/curation/memoryStore')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const Curation = require('../../../lib/curation')
const sinon = require('sinon')
const extend = require('extend')
const { find } = require('lodash')

chai.use(chaiAsPromised)
const expect = chai.expect

describe('Github Curation Service', () => {
  it('invalidates coordinates when handling merge', async () => {
    const service = createService()
    sinon.stub(service, 'getContributedCurations').callsFake(() => {
      return [createCuration(simpleCuration)]
    })
    const result = await service.getContributedCurations(1, 42)
    const coords = { ...simpleCuration.coordinates }
    const resultCoords = result.map(change => change.data.coordinates)
    expect(resultCoords).to.be.deep.equalInAnyOrder([coords])
    expect(result[0].data.revisions['1.0']).to.be.deep.equal(simpleCuration.revisions['1.0'])
  })

  it('validates valid PR change', async () => {
    const service = createService()
    sinon.stub(service, '_postCommitStatus').returns(Promise.resolve())
    sinon.stub(service, 'getContributedCurations').callsFake(() => {
      return [createCuration()]
    })
    const curations = await service.getContributedCurations(42, 'testBranch')
    await service.validateContributions('42', 'testBranch', curations)
    expect(service._postCommitStatus.calledTwice).to.be.true
    expect(service._postCommitStatus.getCall(0).args[2]).to.be.eq('pending')
    expect(service._postCommitStatus.getCall(1).args[2]).to.be.eq('success')
  })

  it('validates invalid PR change', async () => {
    require('../../../providers/logging/logger')({
      error: sinon.stub()
    })
    const service = createService()
    sinon.stub(service, '_postCommitStatus').returns(Promise.resolve())
    sinon.stub(service, 'getContributedCurations').callsFake(() => {
      return [createInvalidCuration()]
    })
    const curations = await service.getContributedCurations(42, 'testBranch')
    await service.validateContributions('42', 'testBranch', curations)
    expect(service._postCommitStatus.calledTwice).to.be.true
    expect(service._postCommitStatus.getCall(0).args[2]).to.be.eq('pending')
    expect(service._postCommitStatus.getCall(1).args[2]).to.be.eq('error')
  })

  it('merges simple changes', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => simpleCuration.revisions['1.0'])
    const base = { coordinates: definitionCoordinates }
    await service.apply(null, null, base)
    expect(base.described.projectWebsite).to.eq('http://foo.com')
  })

  it('merges complex curation on simple base', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => complexCuration.revisions['1.0'])
    const base = extend(true, {}, simpleHarvested)
    await service.apply(null, null, base)
    expect(base.described.releaseDate).to.eq('2018-10-19')
    expect(base.described.projectWebsite).to.eq('http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    expect(!!file1).to.be.true
    expect(file1.license).to.eq('MIT')
    const file2 = find(base.files, file => file.path === '2.txt')
    expect(!!file2).to.be.true
    expect(file2.license).to.eq('GPL')
  })

  it('merges simple curation on complex base', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => simpleCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvested)
    await service.apply(null, null, base)
    expect(base.described.releaseDate).to.eq('2018-08-09')
    expect(base.described.projectWebsite).to.eq('http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    expect(!!file1).to.be.true
    expect(file1.token).to.eq('1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    expect(!!file2).to.be.true
    expect(file2.token).to.eq('2 token')
  })

  it('merges complex structures', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => complexCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvested)
    await service.apply(null, null, base)
    expect(base.described.projectWebsite).to.eq('http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    expect(!!file1).to.be.true
    expect(file1.license).to.eq('MIT')
    expect(file1.token).to.eq('1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    expect(!!file2).to.be.true
    expect(file2.license).to.eq('GPL')
    expect(file2.token).to.eq('2 token')
  })

  it('overrides file licenses when curated', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => complexCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvestedWithLicenses)
    await service.apply(null, null, base)
    expect(base.described.projectWebsite).to.eq('http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    expect(!!file1).to.be.true
    expect(file1.license).to.eq('MIT')
    expect(file1.token).to.eq('1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    expect(!!file2).to.be.true
    expect(file2.license).to.eq('GPL')
    expect(file2.token).to.eq('2 token')
  })

  it('overrides package license when curated', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => complexCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvestedWithLicenses)
    await service.apply(null, null, base)
    expect(base.licensed.declared).to.eq('Apache-2.0')
  })

  it('fails if definition exists', async () => {
    const { service } = setup()
    const gitHubService = createService(service)
    const contributionPatch = {
      contributionInfo: {
        summary: 'test',
        details: 'test',
        resolution: 'test',
        type: 'missing',
        removeDefinitions: false
      },
      patches: [
        {
          coordinates: curationCoordinates,
          revisions: { '2.6.3': { licensed: { declared: 'Apache-1.0' } } }
        }
      ]
    }

    await expect(
      gitHubService.addOrUpdate(null, gitHubService.github, info, contributionPatch)
    ).to.eventually.be.rejectedWith(
      'The contribution has failed because some of the supplied component definitions do not exist'
    )
  })

  it('create a PR only if all of the definitions exist', async () => {
    const { service } = setup()
    sinon
      .stub(service, 'listAll')
      .callsFake(() => [
        EntityCoordinates.fromObject({ type: 'npm', provider: 'npmjs', name: 'test', revision: '1.0' })
      ])
    const gitHubService = createService(service)
    sinon.stub(gitHubService, '_writePatch').callsFake(() => Promise.resolve())

    const contributionPatch = {
      contributionInfo: {
        summary: 'test',
        details: 'test',
        resolution: 'test',
        type: 'missing',
        removedDefinitions: false
      },
      patches: [
        {
          coordinates: curationCoordinates,
          revisions: { '1.0': { licensed: { declared: 'Apache-1.0' } } }
        }
      ]
    }

    const formatDefinitions = gitHubService._formatDefinitions(contributionPatch.patches)
    expect(formatDefinitions).to.be.deep.equal([
      '- [test 1.0](https://clearlydefined.io/definitions/npm/npmjs/-/test/1.0)'
    ])

    const result = await gitHubService.addOrUpdate(null, gitHubService.github, info, contributionPatch)
    expect(result).to.be.deep.equal({ data: { number: 143 } })
  })
})

const info = 'test'
const curationCoordinates = { type: 'npm', provider: 'npmjs', name: 'test' }
const definitionCoordinates = { ...curationCoordinates, revision: '1.0' }

const simpleCuration = {
  coordinates: curationCoordinates,
  revisions: {
    '1.0': {
      described: { projectWebsite: 'http://foo.com' }
    }
  }
}

const complexCuration = {
  coordinates: curationCoordinates,
  revisions: {
    '1.0': {
      described: { releaseDate: '2018-10-19', projectWebsite: 'http://foo.com' },
      licensed: { declared: 'Apache-2.0' },
      files: [{ path: '1.txt', license: 'MIT' }, { path: '2.txt', license: 'GPL' }]
    }
  }
}

function createService(definitionService = null, endpoints = { website: 'http://localhost:3000' }) {
  require('../../../providers/logging/logger')({
    error: sinon.stub()
  })
  const service = GitHubCurationService(
    {
      owner: 'foobar',
      branch: 'foobar',
      token: 'foobar'
    },
    CurationStore({}),
    endpoints,
    definitionService
  )
  service.github = {
    repos: {
      getBranch: () =>
        Promise.resolve({
          data: {
            commit: {
              sha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d'
            }
          }
        })
    },
    gitdata: { createReference: sinon.stub() },
    issues: { createComment: sinon.stub() },
    pullRequests: {
      create: () =>
        Promise.resolve({
          data: {
            number: 143
          }
        })
    }
  }
  return service
}

const simpleHarvested = {
  coordinates: definitionCoordinates
}

const complexHarvested = {
  coordinates: definitionCoordinates,
  described: { releaseDate: '2018-08-09' },
  files: [{ path: '2.txt', token: '2 token' }, { path: '1.txt', token: '1 token' }]
}

const complexHarvestedWithLicenses = {
  coordinates: definitionCoordinates,
  described: { releaseDate: '2018-08-09' },
  licensed: { declared: 'MIT' },
  files: [
    { path: '2.txt', token: '2 token', license: 'NOASSERT' },
    { path: '1.txt', token: '1 token', license: 'GPL-3.0' }
  ]
}

function createCuration(curation = simpleCuration) {
  return new Curation(curation)
}

function createInvalidCuration() {
  return new Curation({
    coordinates: {
      type: 'sdfdsf',
      provider: 'npmjs',
      name: 'test'
    }
  })
}

function setup(definition, coordinateSpec, curation) {
  const store = { delete: sinon.stub(), get: sinon.stub(), store: sinon.stub() }
  const search = { delete: sinon.stub(), store: sinon.stub() }
  const curator = {
    get: () => Promise.resolve(curation),
    apply: (coordinates, curationSpec, definition) => Promise.resolve(Curation.apply(definition, curation))
  }
  const harvestStore = { getAll: () => Promise.resolve(null) }
  const harvestService = { harvest: sinon.stub().returns(Promise.resolve(null)) }
  const summary = { summarizeAll: () => Promise.resolve(null) }
  const aggregator = { process: () => Promise.resolve(definition) }
  const service = DefinitionService(harvestStore, harvestService, summary, aggregator, curator, store, search)
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, service }
}
