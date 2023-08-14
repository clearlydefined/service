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
const { DateTime } = require('luxon')

chai.use(chaiAsPromised)
const expect = chai.expect
const assert = chai.assert

describe('Github Curation Service', () => {
  it('invalidates coordinates when handling merge', async () => {
    const service = createService()
    sinon.stub(service, 'getContributedCurations').callsFake(() => {
      return [createCuration(simpleCuration)]
    })
    const result = await service.getContributedCurations(1, 42)
    const coords = { ...simpleCuration.coordinates }
    const resultCoords = result.map(change => change.data.coordinates)
    expect(resultCoords).to.be.deep.includes.members([coords])
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
    sinon.stub(service, '_postErrorsComment').returns(Promise.resolve())
    sinon.stub(service, 'getContributedCurations').callsFake(() => {
      return [createInvalidCuration()]
    })

    const curations = await service.getContributedCurations(42, 'testBranch')
    service.logger = { // intercept and verify invalid contribution
      error: (description) => {
        expect(description).to.be.eq('Invalid curations: curations/sdfdsf/npmjs/test.yaml')
      }
    }
    await service.validateContributions('42', 'testBranch', curations)
    expect(service._postCommitStatus.calledTwice).to.be.true
    expect(service._postCommitStatus.getCall(0).args[2]).to.be.eq('pending')
    expect(service._postCommitStatus.getCall(1).args[2]).to.be.eq('error')
    expect(service._postErrorsComment.calledOnce).to.be.true
    expect(service._postErrorsComment.getCall(0).args[1]).to.be.eq('We discovered some errors in this curation when validating it:\n\nThis is an error\n')
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
      skipMultiversionSearch: true,
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
    expect(gitHubService.github.issues.createComment.getCall(0).args[0].body).to.contain(
      '(http://localhost:3000/curations/143)'
    )
  })

  describe('addByMergedCuration()', () => {
    let pr
    let licenseMatcher

    beforeEach(() => {
      pr = {
        number: 1,
        head: { ref: 'curation_branch', sha: '2' },
        base: { ref: 'master', sha: '1' },
        files: [{ filename: 'curations/npm/npmjs/-/test.yaml' }],
        merged_at: '2018-11-13T02:44:34Z'
      }
      const processStub = sinon.stub()
      const licenseFileMatch = {
        policy: 'file match',
        file: 'LICENSE.txt',
        propPath: 'sha256',
        value: 'some hash'
      }
      const licenseMetadataMatch = {
        policy: 'metadata match',
        propPath: 'registryData.manifest.license',
        value: ['LICENSE METADATA']
      }
      processStub.onFirstCall().returns({ isMatching: true, match: [licenseFileMatch] })
      processStub.onSecondCall().returns({ isMatching: true, match: [licenseMetadataMatch] })
      processStub.onThirdCall().returns({ isMatching: true, match: [licenseFileMatch, licenseMetadataMatch] })
      processStub.returns({ isMatching: false })
      licenseMatcher = { process: processStub }
    })

    it('should not create curation if pr is not merged', async () => {
      pr.merged_at = null
      const gitHubService = createService()
      const result = await gitHubService.addByMergedCuration(pr)
      expect(result).to.be.undefined
    })

    it('create a PR with multiversion curation if eligible', async () => {
      const curatedCoordinates = { ...curationCoordinates, revision: '1.0' }
      const component = {
        coordinates: curationCoordinates,
        revisions: { [curatedCoordinates.revision]: { licensed: { declared: 'Apache-1.0' } } }
      }

      const { service, harvestStore } = setup()
      sinon
        .stub(service, 'listAll')
        .callsFake(() => [EntityCoordinates.fromObject({ type: 'npm', provider: 'npmjs', name: 'test', revision: '1.0' })])
      sinon.stub(service, 'list').callsFake(() => [
        'npm/npmjs/-/test/1.0', // curated revision
        'npm/npmjs/-/test/1.1', // license match on file
        'npm/npmjs/-/test/1.2', // license match on metadata
        'npm/npmjs/-/test/1.3', // license match on metadata, but already curated
        'npm/npmjs/-/test/1.4' // no license match, already curated
      ])
      sinon.stub(service, 'getStored').callsFake(() => Promise.resolve())

      const gitHubService = createService(service, licenseMatcher, harvestStore)
      sinon.stub(gitHubService, '_getPatchesFromMergedPullRequest').resolves([component])
      sinon.stub(gitHubService, '_writePatch').callsFake(() => Promise.resolve())
      sinon.stub(gitHubService, 'list').callsFake(() => {
        return {
          curations: { 'npm/npmjs/-/test/1.3': {} },
          contributions: [{ files: [{ revisions: [{ revision: '1.4' }] }] }]
        }
      })

      const expectedResults = [
        { version: '1.1', matchingProperties: [{ file: 'LICENSE.txt' }] },
        {
          version: '1.2', matchingProperties: [{
            propPath: 'registryData.manifest.license',
            value: ['LICENSE METADATA']
          }]
        }]
      const expectedDescription = '- 1.1\n- 1.2\n\nMatching license file(s): LICENSE.txt\nMatching metadata: registryData.manifest.license: ["LICENSE METADATA"]'
      const description = gitHubService._formatMultiversionCuratedRevisions(expectedResults)
      expect(description).to.be.deep.equal(expectedDescription)

      // Check if the flow was correct
      const startMatchingSpy = sinon.spy(gitHubService, '_startMatching')
      const calculateMatchingRevisionAndReasonSpy = sinon.spy(gitHubService, '_calculateMatchingRevisionAndReason')
      const formatRevisionsSpy = sinon.spy(gitHubService, '_formatMultiversionCuratedRevisions')

      const result = await gitHubService.addByMergedCuration(pr)
      expect(result).to.be.deep.equal({ data: { number: 143 } })
      expect(gitHubService.github.issues.createComment.getCall(0).args[0].body).to.contain(
        '(http://localhost:3000/curations/143)'
      )

      assert(startMatchingSpy.calledWith(
        EntityCoordinates.fromObject(definitionCoordinates),
        [
          EntityCoordinates.fromString('npm/npmjs/-/test/1.1'),
          EntityCoordinates.fromString('npm/npmjs/-/test/1.2'),
          EntityCoordinates.fromString('npm/npmjs/-/test/1.3'),
          EntityCoordinates.fromString('npm/npmjs/-/test/1.4'),
        ]))
      assert(calculateMatchingRevisionAndReasonSpy.calledWith(curatedCoordinates))
      assert(formatRevisionsSpy.calledWith(expectedResults))
    })
  })

  describe('autoCurate()', () => {
    let gitHubService
    let matcherResult
    let curationsAndContributions
    const sourceDefinition = {
      coordinates: EntityCoordinates.fromString('npm/npmjs/-/express/4.0.0'),
      described: { tools: ['clearlydefined'] }
    }

    beforeEach(() => {
      const { service } = setup()
      sinon.stub(service, 'getStored').resolves({
        coordinates: EntityCoordinates.fromString('npm/npmjs/-/express/5.0.0')
      })
      const licenseMatcher = {
        process: sinon.stub().callsFake(() => matcherResult)
      }
      const store = {
        list: sinon.stub().callsFake(() => curationsAndContributions)
      }
      const harvestStore = {
        getAll: sinon.stub().resolves({})
      }
      gitHubService = createService(service, licenseMatcher, harvestStore, {}, store)
      // TODO: Should not stub private functions and private properties
      sinon.stub(gitHubService, 'github').value({
        users: { get: sinon.stub() },
      })
      sinon.stub(gitHubService, '_addOrUpdate').resolves({
        data: { number: 1 }
      })
    })

    it('Should auto curate if licenses match', async () => {
      curationsAndContributions = {
        curations: {
          'npm/npmjs/-/express/5.0.0': {
            licensed: { declared: 'MIT' }
          }
        },
        contributions: [{ files: [{ revisions: [{ revision: '5.0.0' }] }] }]
      }
      matcherResult = {
        isMatching: true,
        match: []
      }
      await gitHubService.autoCurate(sourceDefinition)
      expect(gitHubService._addOrUpdate.calledOnce).to.be.true
    })

    it('Should not auto curate if licenses do not match', async () => {
      curationsAndContributions = {
        curations: {
          'npm/npmjs/-/express/5.0.0': {
            licensed: { declared: 'MIT' }
          }
        },
        contributions: [{ files: [{ revisions: [{ revision: '5.0.0' }] }] }]
      }
      matcherResult = {
        isMatching: false
      }
      await gitHubService.autoCurate(sourceDefinition)
      expect(gitHubService._addOrUpdate.called).to.be.false
    })
  })

  describe('reprocessMergedCurations()', () => {
    let gitHubService
    let curationsAndContributions
    let matcherResult

    beforeEach(() => {
      const definitionService = {
        list: sinon.stub().resolves([
          'npm/npmjs/-/express/5.0.0',
          'npm/npmjs/-/express/4.0.0'
        ]),
        getStored: sinon.stub().resolves({
          coordinates: EntityCoordinates.fromString('npm/npmjs/-/express/5.0.0')
        })
      }
      const harvestStore = {
        getAll: sinon.stub().resolves({})
      }
      const licenseMatcher = {
        process: sinon.stub().callsFake(() => matcherResult)
      }
      const store = {
        list: sinon.stub().callsFake(() => curationsAndContributions)
      }
      gitHubService = createService(definitionService, licenseMatcher, harvestStore, {}, store)
      gitHubService.github = {
        users: { get: () => ({ name: 'clearlydefined-bot' }) },
        pullRequests: { create: sinon.stub() },
        issues: { createComment: sinon.stub() }
      }
      // TODO: it's not optimal to mock private functions. But the GitHubCurationService
      // is so complicated now. And it could be refactored to two smaller classes. The lower
      // level class will provide a public addOrUpdate function
      sinon.stub(gitHubService, '_addOrUpdate').resolves({
        data: { number: 1, html_url: 'www.curation.pr.com' }
      })
    })

    it('should create curation pull request for matching version', async () => {
      curationsAndContributions = {
        curations: {
          'npm/npmjs/-/express/5.0.0': {
            licensed: { declared: 'MIT' }
          }
        },
        contributions: [{ files: [{ revisions: [{ revision: '5.0.0' }] }] }]
      }
      matcherResult = {
        isMatching: true,
        match: [{
          file: 'LICENSE.txt'
        }, {
          propPath: 'registryData.manifest.license',
          value: 'LICENSE METADATA'
        }]
      }
      const coordinatesList = [EntityCoordinates.fromString('npm/npmjs/-/express')]
      const result = await gitHubService.reprocessMergedCurations(coordinatesList)
      expect(result).to.have.lengthOf(1)
      expect(result).to.be.deep.includes.members([{
        coordinates: 'npm/npmjs/-/express',
        contributions: [{
          coordinates: 'npm/npmjs/-/express/5.0.0',
          contribution: 'www.curation.pr.com'
        }]
      }])
    })
  })

  describe('verify _getBranchName', () => {
    before(function () {
      sinon.replace(DateTime, 'now', sinon.stub().callsFake()
        .returns(DateTime.fromFormat('211203_140949.712', 'yyMMdd_HHmmss.SSS')))
    })

    after(function () {
      sinon.restore()
    })

    it('verify branch name', () => {
      const branchName = createService()._getBranchName({ login: 'test' })
      expect(branchName).to.be.eq('test_211203_140949.712')
    })
  })

  describe('verify _getCurationReviewUrl', () => {
    it('verify branch name', () => {
      const curationReviewUrl = createService()._getCurationReviewUrl(143)
      expect(curationReviewUrl).to.be.eq('http://localhost:3000/curations/143')
    })
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

function createService(definitionService = null, licenseMatcher = null, harvestStore = null, endpoints = { website: 'http://localhost:3000' }, store = CurationStore({})) {
  const mockCache = {
    get: sinon.stub().resolves(undefined),
    set: sinon.stub(),
  }
  require('../../../providers/logging/logger')({
    error: sinon.stub(),
    info: sinon.stub()
  })
  const service = GitHubCurationService(
    {
      owner: 'foobar',
      branch: 'foobar',
      token: 'foobar',
      multiversionCurationFeatureFlag: true
    },
    store,
    endpoints,
    definitionService,
    mockCache,
    harvestStore,
    licenseMatcher
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
    },
    users: { get: () => ({ name: 'clearlydefined-bot' }) }
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
  let invalidCuration = new Curation({
    coordinates: {
      type: 'sdfdsf',
      provider: 'npmjs',
      name: 'test'
    }
  })

  invalidCuration.path = 'curations/sdfdsf/npmjs/test.yaml'
  invalidCuration.errors = [
    {
      message: 'Invalid license in curation',
      error: 'This is an error'
    }
  ]
  return invalidCuration
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

  return { coordinates, service, harvestStore }
}
