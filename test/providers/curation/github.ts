import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it, mock } from 'node:test'
import sinon from 'sinon'
import { assertDeepEqualInAnyOrder } from '../../helpers/assert.ts'
// @ts-nocheck
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import extend from 'extend'
import lodash from 'lodash'
import DefinitionService from '../../../business/definitionService.js'
import Curation from '../../../lib/curation.js'
import EntityCoordinates from '../../../lib/entityCoordinates.js'
import GitHubCurationService from '../../../providers/curation/github.js'
import CurationStore from '../../../providers/curation/memoryStore.js'

const { find } = lodash

import logger from '../../../providers/logging/logger.js'


describe('Github Curation Service', () => {
  beforeEach(() => {
    logger({
      error: mock.fn(),
      info: mock.fn(),
      debug: mock.fn()
    })
  })
  it('invalidates coordinates when handling merge', async () => {
    const service = createService()
    mock.method(service, 'getContributedCurations', () => {
      return [createCuration(simpleCuration)]
    })
    const result = await service.getContributedCurations(1, 42)
    const coords = { ...simpleCuration.coordinates }
    const resultCoords = result.map(change => change.data.coordinates)
    assertDeepEqualInAnyOrder(resultCoords, [coords])
    assert.deepStrictEqual(result[0].data.revisions['1.0'], simpleCuration.revisions['1.0'])
  })

  it('validates valid PR change', async () => {
    const service = createService()
    mock.method(service, '_postCommitStatus', () => Promise.resolve())
    mock.method(service, 'getContributedCurations', () => {
      return [createCuration()]
    })
    const curations = await service.getContributedCurations(42, 'testBranch')
    await service.validateContributions('42', 'testBranch', curations)
    assert.strictEqual(service._postCommitStatus.mock.callCount() === 2, true)
    assert.strictEqual(service._postCommitStatus.mock.calls[0].arguments[2], 'pending')
    assert.strictEqual(service._postCommitStatus.mock.calls[1].arguments[2], 'success')
  })

  it('validates invalid PR change', async () => {
    logger({
      error: mock.fn()
    })
    const service = createService()
    mock.method(service, '_postCommitStatus', () => Promise.resolve())
    mock.method(service, '_postErrorsComment', () => Promise.resolve())
    mock.method(service, 'getContributedCurations', () => {
      return [createInvalidCuration()]
    })

    const curations = await service.getContributedCurations(42, 'testBranch')
    service.logger = {
      // intercept and verify invalid contribution
      error: description => {
        assert.strictEqual(description, 'Invalid curations: curations/sdfdsf/npmjs/test.yaml')
      }
    }
    await service.validateContributions('42', 'testBranch', curations)
    assert.strictEqual(service._postCommitStatus.mock.callCount() === 2, true)
    assert.strictEqual(service._postCommitStatus.mock.calls[0].arguments[2], 'pending')
    assert.strictEqual(service._postCommitStatus.mock.calls[1].arguments[2], 'error')
    assert.strictEqual(service._postErrorsComment.mock.callCount() === 1, true)
    assert.strictEqual(service._postErrorsComment.mock.calls[0].arguments[1],
      'We discovered some errors in this curation when validating it:\n\nThis is an error\n'
    )
  })

  it('merges simple changes', async () => {
    const service = createService()
    mock.method(service, 'get', () => simpleCuration.revisions['1.0'])
    const base = { coordinates: definitionCoordinates }
    await service.apply(null, null, base)
    assert.strictEqual(base.described.projectWebsite, 'http://foo.com')
  })

  it('merges complex curation on simple base', async () => {
    const service = createService()
    mock.method(service, 'get', () => complexCuration.revisions['1.0'])
    const base = extend(true, {}, simpleHarvested)
    await service.apply(null, null, base)
    assert.strictEqual(base.described.releaseDate, '2018-10-19')
    assert.strictEqual(base.described.projectWebsite, 'http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    assert.strictEqual(!!file1, true)
    assert.strictEqual(file1.license, 'MIT')
    const file2 = find(base.files, file => file.path === '2.txt')
    assert.strictEqual(!!file2, true)
    assert.strictEqual(file2.license, 'GPL')
  })

  it('merges simple curation on complex base', async () => {
    const service = createService()
    mock.method(service, 'get', () => simpleCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvested)
    await service.apply(null, null, base)
    assert.strictEqual(base.described.releaseDate, '2018-08-09')
    assert.strictEqual(base.described.projectWebsite, 'http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    assert.strictEqual(!!file1, true)
    assert.strictEqual(file1.token, '1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    assert.strictEqual(!!file2, true)
    assert.strictEqual(file2.token, '2 token')
  })

  it('merges complex structures', async () => {
    const service = createService()
    mock.method(service, 'get', () => complexCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvested)
    await service.apply(null, null, base)
    assert.strictEqual(base.described.projectWebsite, 'http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    assert.strictEqual(!!file1, true)
    assert.strictEqual(file1.license, 'MIT')
    assert.strictEqual(file1.token, '1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    assert.strictEqual(!!file2, true)
    assert.strictEqual(file2.license, 'GPL')
    assert.strictEqual(file2.token, '2 token')
  })

  it('overrides file licenses when curated', async () => {
    const service = createService()
    mock.method(service, 'get', () => complexCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvestedWithLicenses)
    await service.apply(null, null, base)
    assert.strictEqual(base.described.projectWebsite, 'http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    assert.strictEqual(!!file1, true)
    assert.strictEqual(file1.license, 'MIT')
    assert.strictEqual(file1.token, '1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    assert.strictEqual(!!file2, true)
    assert.strictEqual(file2.license, 'GPL')
    assert.strictEqual(file2.token, '2 token')
  })

  it('overrides package license when curated', async () => {
    const service = createService()
    mock.method(service, 'get', () => complexCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvestedWithLicenses)
    await service.apply(null, null, base)
    assert.strictEqual(base.licensed.declared, 'Apache-2.0')
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

    await assert.rejects(
      gitHubService.addOrUpdate(null, gitHubService.github, info, contributionPatch),
      { message: 'The contribution has failed because some of the supplied component definitions do not exist' }
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
    mock.method(gitHubService, '_writePatch', () => Promise.resolve())

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
    assert.deepStrictEqual(formatDefinitions, [
      '- [test 1.0](https://clearlydefined.io/definitions/npm/npmjs/-/test/1.0)'
    ])

    const result = await gitHubService.addOrUpdate(null, gitHubService.github, info, contributionPatch)
    assert.deepStrictEqual(result, { data: { number: 143 } })
    assert.ok(gitHubService.github.rest.issues.createComment.mock.calls[0].arguments[0].body.includes(
      '(http://localhost:3000/curations/143))'
    ))
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
      let processCallCount = 0
      const processStub = mock.fn(() => {
        processCallCount++
        if (processCallCount === 1) return { isMatching: true, match: [licenseFileMatch] }
        if (processCallCount === 2) return { isMatching: true, match: [licenseMetadataMatch] }
        if (processCallCount === 3) return { isMatching: true, match: [licenseFileMatch, licenseMetadataMatch] }
        return { isMatching: false }
      })
      licenseMatcher = { process: processStub }
    })

    it('should not create curation if pr is not merged', async () => {
      pr.merged_at = null
      const gitHubService = createService()
      const result = await gitHubService.addByMergedCuration(pr)
      assert.strictEqual(result, undefined)
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
        .callsFake(() => [
          EntityCoordinates.fromObject({ type: 'npm', provider: 'npmjs', name: 'test', revision: '1.0' })
        ])
      mock.method(service, 'list', () => [
        'npm/npmjs/-/test/1.0', // curated revision
        'npm/npmjs/-/test/1.1', // license match on file
        'npm/npmjs/-/test/1.2', // license match on metadata
        'npm/npmjs/-/test/1.3', // license match on metadata, but already curated
        'npm/npmjs/-/test/1.4' // no license match, already curated
      ])
      mock.method(service, 'getStored', () => Promise.resolve())

      const gitHubService = createService(service, licenseMatcher, harvestStore)
      mock.method(gitHubService, '_getPatchesFromMergedPullRequest', async () => [component])
      mock.method(gitHubService, '_writePatch', () => Promise.resolve())
      mock.method(gitHubService, 'list', () => {
        return {
          curations: { 'npm/npmjs/-/test/1.3': {} },
          contributions: [{ files: [{ revisions: [{ revision: '1.4' }] }] }]
        }
      })

      const expectedResults = [
        { version: '1.1', matchingProperties: [{ file: 'LICENSE.txt' }] },
        {
          version: '1.2',
          matchingProperties: [
            {
              propPath: 'registryData.manifest.license',
              value: ['LICENSE METADATA']
            }
          ]
        }
      ]
      const expectedDescription =
        '- 1.1\n- 1.2\n\nMatching license file(s): LICENSE.txt\nMatching metadata: registryData.manifest.license: ["LICENSE METADATA"]'
      const description = gitHubService._formatMultiversionCuratedRevisions(expectedResults)
      assert.deepStrictEqual(description, expectedDescription)

      // Check if the flow was correct
      const startMatchingSpy = mock.method(gitHubService, '_startMatching')
      const calculateMatchingRevisionAndReasonSpy = mock.method(gitHubService, '_calculateMatchingRevisionAndReason')
      const formatRevisionsSpy = mock.method(gitHubService, '_formatMultiversionCuratedRevisions')
      const result = await gitHubService.addByMergedCuration(pr)
      assert.deepStrictEqual(result, { data: { number: 143 } })
      assert.ok(gitHubService.github.rest.issues.createComment.mock.calls[0].arguments[0].body.includes(
        '(http://localhost:3000/curations/143))'
      ))

      assert(
        startMatchingSpy.calledWith(EntityCoordinates.fromObject(definitionCoordinates), [
          EntityCoordinates.fromString('npm/npmjs/-/test/1.1'),
          EntityCoordinates.fromString('npm/npmjs/-/test/1.2'),
          EntityCoordinates.fromString('npm/npmjs/-/test/1.3'),
          EntityCoordinates.fromString('npm/npmjs/-/test/1.4')
        ])
      )
      assert(formatRevisionsSpy.calledWith(expectedResults))
      assert(
        calculateMatchingRevisionAndReasonSpy.calledWith(
          sinon.match(
            obj =>
              obj.type === curatedCoordinates.type &&
              obj.provider === curatedCoordinates.provider &&
              obj.name === curatedCoordinates.name &&
              obj.revision === curatedCoordinates.revision
          )
        )
      )
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
      mock.method(service, 'getStored', async () => ({
        coordinates: EntityCoordinates.fromString('npm/npmjs/-/express/5.0.0')
      }))
      const licenseMatcher = {
        process: mock.fn(() => matcherResult)
      }
      const store = {
        list: mock.fn(() => curationsAndContributions)
      }
      const harvestStore = {
        getAll: mock.fn(async () => {})
      }
      gitHubService = createService(service, licenseMatcher, harvestStore, {}, store)
      // TODO: Should not stub private functions and private properties
      mock.method(gitHubService, 'github').value({
        rest: { users: { get: mock.fn() } }
      })
      mock.method(gitHubService, '_addOrUpdate', async () => ({
        data: { number: 1 }
      }))
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
      assert.strictEqual(gitHubService._addOrUpdate.mock.callCount() === 1, true)
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
      assert.strictEqual(gitHubService._addOrUpdate.mock.callCount() > 0, false)
    })
  })

  describe('reprocessMergedCurations()', () => {
    let gitHubService
    let curationsAndContributions
    let matcherResult

    beforeEach(() => {
      const definitionService = {
        list: mock.fn(async () => ['npm/npmjs/-/express/5.0.0', 'npm/npmjs/-/express/4.0.0']),
        getStored: mock.fn(async () => ({
          coordinates: EntityCoordinates.fromString('npm/npmjs/-/express/5.0.0')
        }))
      }
      const harvestStore = {
        getAll: mock.fn(async () => {})
      }
      const licenseMatcher = {
        process: mock.fn(() => matcherResult)
      }
      const store = {
        list: mock.fn(() => curationsAndContributions)
      }
      gitHubService = createService(definitionService, licenseMatcher, harvestStore, {}, store)
      gitHubService.github = {
        rest: {
          users: { get: () => ({ name: 'clearlydefined-bot' }) },
          pullRequests: { create: mock.fn() },
          issues: { createComment: mock.fn() }
        }
      }
      // TODO: it's not optimal to mock private functions. But the GitHubCurationService
      // is so complicated now. And it could be refactored to two smaller classes. The lower
      // level class will provide a public addOrUpdate function
      mock.method(gitHubService, '_addOrUpdate', async () => ({
        data: { number: 1, html_url: 'www.curation.pr.com' }
      }))
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
        match: [
          {
            file: 'LICENSE.txt'
          },
          {
            propPath: 'registryData.manifest.license',
            value: 'LICENSE METADATA'
          }
        ]
      }
      const coordinatesList = [EntityCoordinates.fromString('npm/npmjs/-/express')]
      const result = await gitHubService.reprocessMergedCurations(coordinatesList)
      assert.strictEqual(result.length, 1)
      assertDeepEqualInAnyOrder(result, [
        {
          coordinates: 'npm/npmjs/-/express',
          contributions: [
            {
              coordinates: 'npm/npmjs/-/express/5.0.0',
              contribution: 'www.curation.pr.com'
            }
          ]
        }
      ])
    })
  })

  describe('verify _getBranchName', () => {
    let clock: any

    before(() => {
      // 2021-12-03T14:09:49.712Z
      clock = sinon.useFakeTimers(new Date(2021, 11, 3, 14, 9, 49, 712))
    })

    after(() => {
      clock.restore()
    })

    it('verify branch name', () => {
      const branchName = createService()._getBranchName({ login: 'test' })
      assert.strictEqual(branchName, 'test_211203_140949.712')
    })
  })

  describe('verify _getCurationReviewUrl', () => {
    it('verify branch name', () => {
      const curationReviewUrl = createService()._getCurationReviewUrl(143)
      assert.strictEqual(curationReviewUrl, 'http://localhost:3000/curations/143')
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
      files: [
        { path: '1.txt', license: 'MIT' },
        { path: '2.txt', license: 'GPL' }
      ]
    }
  }
}

function createService(
  definitionService = null,
  licenseMatcher = null,
  harvestStore = null,
  endpoints = { website: 'http://localhost:3000' },
  store = CurationStore({})
) {
  const mockCache = {
    get: mock.fn(async () => undefined),
    set: mock.fn()
  }
  logger({
    error: mock.fn(),
    info: mock.fn()
  })
  const service = GitHubCurationService(
    {
      owner: 'foobar',
      branch: 'foobar',
      repo: 'foobar',
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
    rest: {
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
      git: {
        createRef: mock.fn()
      },
      issues: { createComment: mock.fn() },
      pulls: {
        create: () =>
          Promise.resolve({
            data: {
              number: 143
            }
          })
      },
      users: { get: () => ({ name: 'clearlydefined-bot' }) }
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
  files: [
    { path: '2.txt', token: '2 token' },
    { path: '1.txt', token: '1 token' }
  ]
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
  const invalidCuration = new Curation({
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
  const store = { delete: mock.fn(), get: mock.fn(), store: mock.fn() }
  const search = { delete: mock.fn(), store: mock.fn() }
  const curator = {
    get: () => Promise.resolve(curation),
    apply: (_coordinates, _curationSpec, definition) => Promise.resolve(Curation.apply(definition, curation))
  }
  const harvestStore = { getAll: () => Promise.resolve(null) }
  const harvestService = { harvest: mock.fn(() => Promise.resolve(null)) }
  const summary = { summarizeAll: () => Promise.resolve(null) }
  const aggregator = { process: () => Promise.resolve(definition) }
  const service = DefinitionService(harvestStore, harvestService, summary, aggregator, curator, store, search)
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')

  return { coordinates, service, harvestStore }
}
