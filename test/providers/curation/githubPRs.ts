import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { afterEach, before, describe, it, mock } from 'node:test'
import { assertDeepEqualInAnyOrder } from '../../helpers/assert.ts'

// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

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
        files: [
          { path: `${name}.1.txt`, license: 'MIT' },
          { path: `${name}.2.txt`, license: 'GPL' }
        ]
      }
    }
  }
}

const files = {
  'curations/npm/npmjs/-/foo.yaml': { sha: 42, content: complexCuration('foo') },
  'curations/npm/npmjs/-/bar.yaml': { sha: 52, content: complexCuration('bar') }
}

const prs = {
  11: {
    number: 12,
    head: { ref: 'master', sha: '32' },
    files: [{ filename: 'curations/npm/npmjs/-/foo.yaml' }]
  },
  12: {
    number: 12,
    head: { ref: 'master', sha: '32' },
    files: [{ filename: 'curations/npm/npmjs/-/foo.yaml' }],
    merged_at: '2018-11-13T02:44:34Z'
  },
  13: {
    number: 13,
    head: { ref: 'master', sha: '72' },
    files: [{ filename: 'curations/npm/npmjs/-/foo.yaml' }, { filename: 'curations/npm/npmjs/-/bar.yaml' }],
    merged_at: '2018-11-13T02:44:34Z'
  }
}

const defaultCurations = {
  'npm/npmjs/-/test': complexCuration()
}

describe('Curation service pr events', () => {
  before(() => {
    require('../../../providers/logging/logger')({
      error: mock.fn(),
      info: mock.fn(),
      debug: mock.fn()
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('handles open', async () => {
    const service = createService({})
    await service.updateContribution(prs[11])
    const updateSpy = service.store.updateContribution
    assert.strictEqual(updateSpy.mock.callCount() === 1, true)
    assert.strictEqual(updateSpy.mock.calls[0].arguments[0].number, 12)
    const data = updateSpy.mock.calls[0].arguments[1].map(curation => curation.data)
    assertDeepEqualInAnyOrder(data, [complexCuration()])
    const cacheDeleteSpy = service.cache.delete
    assert.strictEqual(cacheDeleteSpy.mock.callCount() === 2, true)
    assertDeepEqualInAnyOrder(
      [cacheDeleteSpy.mock.calls[0].arguments[0], cacheDeleteSpy.mock.calls[1].arguments[0]],
      ['cur_npm/npmjs/-/foo/1.0', 'cur_npm/npmjs/-/foo']
    )
  }).timeout(8000) // First time loading proxyquire('../../../providers/curation/github') is very slow.

  it('handles update', async () => {
    const service = createService({})
    await service.updateContribution(prs[11])
    const updateSpy = service.store.updateContribution
    assert.strictEqual(updateSpy.mock.callCount() === 1, true)
    assert.strictEqual(updateSpy.mock.calls[0].arguments[0].number, 12)
    const data = updateSpy.mock.calls[0].arguments[1].map(curation => curation.data)
    assertDeepEqualInAnyOrder(data, [complexCuration()])
    const cacheDeleteSpy = service.cache.delete
    assert.strictEqual(cacheDeleteSpy.mock.callCount() === 2, true)
    assertDeepEqualInAnyOrder(
      [cacheDeleteSpy.mock.calls[0].arguments[0], cacheDeleteSpy.mock.calls[1].arguments[0]],
      ['cur_npm/npmjs/-/foo/1.0', 'cur_npm/npmjs/-/foo']
    )
  })

  it('handles merge', async () => {
    const service = createService({})
    await service.updateContribution(prs[12])

    const updateSpy = service.store.updateContribution
    assert.strictEqual(updateSpy.mock.callCount() === 1, true)
    assert.strictEqual(updateSpy.mock.calls[0].arguments[0].number, 12)
    const data = updateSpy.mock.calls[0].arguments[1].map(curation => curation.data)
    assertDeepEqualInAnyOrder(data, [complexCuration()])

    const curationSpy = service.store.updateCurations
    assert.strictEqual(curationSpy.mock.callCount() === 1, true)
    const curations = curationSpy.mock.calls[0].arguments[0].map(curation => curation.data)
    assertDeepEqualInAnyOrder(curations, [complexCuration()])

    const invalidateSpy = service.definitionService.invalidate
    assert.strictEqual(invalidateSpy.mock.callCount() === 1, true)
    assertDeepEqualInAnyOrder(invalidateSpy.mock.calls[0].arguments[0], [
      { ...complexCuration().coordinates, revision: '1.0' }
    ])

    const cacheDeleteSpy = service.cache.delete
    assert.strictEqual(cacheDeleteSpy.mock.callCount() === 2, true)
    assertDeepEqualInAnyOrder(
      [cacheDeleteSpy.mock.calls[0].arguments[0], cacheDeleteSpy.mock.calls[1].arguments[0]],
      ['cur_npm/npmjs/-/foo/1.0', 'cur_npm/npmjs/-/foo']
    )

    const computeSpy = service.definitionService.computeAndStore
    assert.strictEqual(computeSpy.mock.callCount() === 1, true)
    assert.deepStrictEqual(computeSpy.mock.calls[0].arguments[0], { ...complexCuration().coordinates, revision: '1.0' })
  })

  it('handles close', async () => {
    const service = createService({})
    await service.updateContribution(prs[12])
    const updateSpy = service.store.updateContribution
    assert.strictEqual(updateSpy.mock.callCount() === 1, true)
    assert.strictEqual(updateSpy.mock.calls[0].arguments[0].number, 12)
    const cacheDeleteSpy = service.cache.delete
    assert.strictEqual(cacheDeleteSpy.mock.callCount() === 2, true)
    assertDeepEqualInAnyOrder(
      [cacheDeleteSpy.mock.calls[0].arguments[0], cacheDeleteSpy.mock.calls[1].arguments[0]],
      ['cur_npm/npmjs/-/foo/1.0', 'cur_npm/npmjs/-/foo']
    )
  })

  it('handles list', async () => {
    const service = createService({})
    service.store.curations = defaultCurations
    const list = await service.list(EntityCoordinates.fromString('npm/npmjs'))
    const listSpy = service.store.list
    assert.strictEqual(listSpy.mock.callCount() === 1, true)
    assertDeepEqualInAnyOrder(list, [complexCuration()])
    const cacheGetSpy = service.cache.get
    assert.strictEqual(cacheGetSpy.mock.callCount() === 1, true)
    assert.strictEqual(cacheGetSpy.mock.calls[0].arguments[0], 'cur_npm/npmjs/-')
    const cacheSetSpy = service.cache.set
    assert.strictEqual(cacheSetSpy.mock.callCount() === 1, true)
    assert.strictEqual(cacheGetSpy.mock.calls[0].arguments[0], 'cur_npm/npmjs/-')
  })

  it('handles failure to compute one definition of multiple', async () => {
    const service = createService({})
    await service.updateContribution(prs[13])

    const updateSpy = service.store.updateContribution
    assert.strictEqual(updateSpy.mock.callCount() === 1, true)
    assert.strictEqual(updateSpy.mock.calls[0].arguments[0].number, 13)
    const data = updateSpy.mock.calls[0].arguments[1].map(curation => curation.data)
    assertDeepEqualInAnyOrder(data, [complexCuration('foo'), complexCuration('bar')])

    const curationSpy = service.store.updateCurations
    assert.strictEqual(curationSpy.mock.callCount() === 1, true)
    const curations = curationSpy.mock.calls[0].arguments[0].map(curation => curation.data)
    assertDeepEqualInAnyOrder(curations, [complexCuration('foo'), complexCuration('bar')])

    const invalidateSpy = service.definitionService.invalidate
    assert.strictEqual(invalidateSpy.mock.callCount() === 1, true)
    assertDeepEqualInAnyOrder(invalidateSpy.mock.calls[0].arguments[0], [
      { ...complexCuration('foo').coordinates, revision: '1.0' },
      { ...complexCuration('bar').coordinates, revision: '1.0' }
    ])

    const computeSpy = service.definitionService.computeAndStore
    assert.strictEqual(computeSpy.mock.callCount() === 2, true)
    assert.deepStrictEqual(computeSpy.mock.calls[0].arguments[0], {
      ...complexCuration('foo').coordinates,
      revision: '1.0'
    })
  })

  it('gets null curation if blob does not exist', async () => {
    const service = createService({
      geitStubOverride: () => {
        return {
          tree: ref => {
            assert.strictEqual(ref, 'branch')
            return Promise.resolve()
          },
          blob: () => Promise.resolve(Buffer.alloc(0))
        }
      }
    })
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0.0')
    const content = await service._getCurations(coordinates)
    assert.strictEqual(content, null)
  })

  it('getCuration should access tree with children', async () => {
    const theYaml = `coordinates:
  name: test
  provider: npmjs
  type: npm
revisions:
  thisisasha:
    licensed:
      declared: MIT
`
    const service = createService({
      geitStubOverride: () => {
        return {
          tree: ref => {
            assert.strictEqual(ref, 'branch')
            return Promise.resolve({
              curations: {
                children: {
                  npm: {
                    children: { npmjs: { children: { '-': { children: { 'test.yaml': { object: 'thisisasha' } } } } } }
                  }
                }
              }
            })
          },
          blob: ref => {
            assert.strictEqual(ref, 'thisisasha')
            return Promise.resolve(Buffer.from(theYaml))
          }
        }
      }
    })
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0.0')
    const content = await service._getCurations(coordinates)
    assert.deepStrictEqual(content, {
      coordinates: {
        type: 'npm',
        name: 'test',
        provider: 'npmjs'
      },
      revisions: {
        thisisasha: {
          licensed: { declared: 'MIT' }
        }
      }
    })
    assert.strictEqual(content._origin.sha, 'thisisasha')
  })

  it('getCurations should use pr ref', async () => {
    const service = createService({
      geitStubOverride: () => {
        return {
          tree: ref => {
            assert.strictEqual(ref, 'refs/pull/123/head')
            return Promise.resolve()
          },
          blob: () => Promise.resolve(Buffer.alloc(0))
        }
      }
    })
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0.0')
    const content = await service._getCurations(coordinates, 123)
    assert.strictEqual(content, null)
  })
})

function createService({ failsCompute = false, geitStubOverride = null }) {
  const store = CurationStore({})
  mock.method(store, 'updateContribution')
  mock.method(store, 'updateCurations')
  mock.method(store, 'list')
  const definitionService = {
    invalidate: mock.fn(),
    computeAndStore: mock.fn(() => (failsCompute ? Promise.reject('error') : Promise.resolve(null)))
  }
  const cache = {
    get: mock.fn(),
    set: mock.fn(),
    delete: mock.fn()
  }
  const geitStub =
    geitStubOverride ||
    (() => {
      return {
        tree: () => Promise.resolve(),
        blob: () => Promise.resolve(Buffer.alloc(0))
      }
    })

  require('../../../providers/logging/logger')({
    error: mock.fn(),
    info: mock.fn(),
    debug: mock.fn()
  })

  const service = proxyquire('../../../providers/curation/github', { geit: geitStub })(
    { owner: 'owner', repo: 'repo', branch: 'branch', token: 'token' },
    store,
    { website: 'http://localhost:3000' },
    definitionService,
    cache
  )
  service.github = {
    rest: {
      pulls: {
        listFiles: ({ pull_number: number }) => {
          return { data: prs[number].files }
        },
        get: ({ number }) => {
          return { data: { head: prs[number].head } }
        }
      },
      repos: {
        createStatus: mock.fn(),
        getContent: ({ path }) => {
          return {
            data: {
              sha: files[path].sha,
              content: base64.encode(yaml.dump(files[path].content, { sortKeys: true, lineWidth: 150 }))
            }
          }
        }
      }
    }
  }
  return service
}
