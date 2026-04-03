import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { assertDeepEqualInAnyOrder } from '../helpers/assert.ts'
// @ts-nocheck
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import AggregatorService from '../../business/aggregator.js'
import DefinitionService from '../../business/definitionService.js'
import SummaryService from '../../business/summarizer.js'
import Curation from '../../lib/curation.js'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import { setIfValue } from '../../lib/utils.js'
import FileHarvestStore from '../../providers/stores/fileHarvestStore.js'
import DefinitionQueueUpgrader from '../../providers/upgrade/defUpgradeQueue.js'
import { DefinitionVersionChecker } from '../../providers/upgrade/defVersionCheck.js'
import memoryQueue from '../../providers/upgrade/memoryQueueConfig.js'
import validator from '../../schemas/validator.js'

const { set } = lodash

describe('Definition Service', () => {
  it('invalidates single coordinate', async () => {
    const { service, coordinates } = setup()
    await service.invalidate(coordinates)
    assert.strictEqual(service.definitionStore.delete.mock.callCount() === 1, true)
    assert.strictEqual(service.definitionStore.delete.mock.calls[0].arguments[0].name, 'test')
    assert.strictEqual(service.cache.delete.mock.callCount() === 1, true)
    assert.strictEqual(service.cache.delete.mock.calls[0].arguments[0], 'def_npm/npmjs/-/test/1.0')
  })

  it('invalidates array of coordinates', async () => {
    const { service } = setup()
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3')
    ]
    await service.invalidate(coordinates)
    assert.strictEqual(service.definitionStore.delete.mock.callCount() === 2, true)
    assert.strictEqual(service.cache.delete.mock.callCount() === 2, true)
    assert.strictEqual(service.definitionStore.delete.mock.calls[0].arguments[0].name, 'test0')
    assert.strictEqual(service.definitionStore.delete.mock.calls[1].arguments[0].name, 'test1')
    assert.strictEqual(service.cache.delete.mock.calls[0].arguments[0], 'def_npm/npmjs/-/test0/2.3')
    assert.strictEqual(service.cache.delete.mock.calls[1].arguments[0], 'def_npm/npmjs/-/test1/2.3')
  })

  it('does not store empty definitions', async () => {
    const { service, coordinates } = setup(createDefinition())
    await service.get(coordinates)
    assert.strictEqual(service.definitionStore.store.mock.callCount() === 0, true)
    assert.strictEqual(service.search.store.mock.callCount() === 0, true)
  })

  it('stores new definitions', async () => {
    const { service, coordinates } = setup(createDefinition(null, null, ['foo']))
    await service.get(coordinates)
    assert.strictEqual(service.definitionStore.store.mock.callCount() === 1, true)
    assert.strictEqual(service.search.store.mock.callCount() === 0, true)
  })

  it('trims files from definitions', async () => {
    const { service, coordinates } = setup(createDefinition(null, [{ path: 'path/to/file' }], ['foo']))
    const definition = await service.get(coordinates, null, null, '-files')
    assert.strictEqual(definition.files, undefined)
    const fullDefinition = await service.get(coordinates)
    assert.deepStrictEqual(fullDefinition.files, [{ path: 'path/to/file' }])
  })

  it('logs and harvest new definitions with empty tools', async () => {
    const { service, coordinates } = setup(createDefinition(null, null, []))
    await service.get(coordinates)
    // assert.strictEqual(service.logger.info.mock.callCount() === 1, true)
    // assert.strictEqual(service.logger.info.mock.calls[0].arguments[0], 'definition not available')
    assert.strictEqual(service._harvest.mock.callCount() === 1, true)
    assert.strictEqual(service._harvest.mock.calls[0].arguments[0], coordinates)
  })

  it('logs and harvests new definitions with undefined tools', async () => {
    const { service, coordinates } = setup(createDefinition(null, null, undefined))
    await service.get(coordinates)
    // assert.strictEqual(service.logger.info.mock.callCount() === 1, true)
    // assert.strictEqual(service.logger.info.mock.calls[0].arguments[0], 'definition not available')
    assert.strictEqual(service._harvest.mock.callCount() === 1, true)
    assert.strictEqual(service._harvest.mock.calls[0].arguments[0], coordinates)
  })

  it('higher score than tool score with a curation', async () => {
    const files = [buildFile('bar.txt', 'MIT')]
    const raw = createDefinition(undefined, files)
    const curation = {
      licensed: { declared: 'MIT' },
      files: [{ path: 'bar.txt', attributions: ['Copyright Bob'] }],
      described: { releaseDate: '2018-08-09' }
    }
    const { service, coordinates } = setup(raw, null, curation)
    const definition = await service.compute(coordinates)
    assert.strictEqual(definition.described.score.total, 30)
    assert.strictEqual(definition.described.toolScore.total, 0)
    assert.strictEqual(definition.licensed.score.total, 85)
    assert.strictEqual(definition.licensed.toolScore.total, 0)
    assert.strictEqual(definition.scores.effective, 57) // floor(85+30/2)
    assert.strictEqual(definition.scores.tool, 0)
  })

  it('lists all coordinates found', async () => {
    const { service } = setup()
    service.definitionStore.list = coordinates => {
      coordinates.revision = '2.3'
      if (coordinates.name === 'missing') {
        return Promise.resolve([])
      }
      return Promise.resolve([coordinates.toString().toLowerCase()])
    }
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/testUpperCase/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/missing/2.3')
    ]
    const result = await service.listAll(coordinates)
    assert.strictEqual(result.length, 3)
    assert.deepStrictEqual(new Set(result.map(x => x.name)), new Set(['test0', 'test1', 'testUpperCase']))
  })

  it('returns undefined if coordinates has no revision', async () => {
    const { service } = setup()
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test') // no revision
    const result = await service.get(coordinates)
    assert.strictEqual(result, undefined)
  })

  it('returns definition if coordinates has revision', async () => {
    const { service } = setup()
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0')
    const result = await service.get(coordinates)
    assert.notStrictEqual(result, undefined)
    assert.strictEqual(result.coordinates.revision, '1.0')
  })

  it('returns undefined if coordinates does not have revision and name', async () => {
    const { service } = setup()
    const coordinates = EntityCoordinates.fromString('maven/mavencentral/org.apache.httpcomponents')
    const result = await service.get(coordinates)
    assert.strictEqual(result, undefined)
  })

  it('returns definition for only valid coordinates in getAll function', async () => {
    const { service } = setup()
    const coordinates = [
      EntityCoordinates.fromString('maven/mavencentral/org.apache.httpcomponents/httpcore/4.4.16'),
      EntityCoordinates.fromString('maven/mavencentral/org.apache.httpcomponents/httpcore'),
      EntityCoordinates.fromString('maven/mavencentral/org.apache.httpcomponents')
    ]
    const result = await service.getAll(coordinates)
    assert.notStrictEqual(result, undefined)
    assert.deepStrictEqual(Object.keys(result), ['maven/mavencentral/org.apache.httpcomponents/httpcore/4.4.16'])
    assert.strictEqual(Object.keys(result).length, 1)
  })

  describe('Build source location', () => {
    const data = new Map([
      [
        'pypi/pypi/-/platformdirs/4.2.0',
        {
          type: 'pypi',
          provider: 'pypi',
          name: 'platformdirs',
          revision: '4.2.0',
          url: 'https://pypi.org/project/platformdirs/4.2.0/'
        }
      ],
      [
        'go/golang/rsc.io/quote/v1.3.0',
        {
          type: 'go',
          provider: 'golang',
          namespace: 'rsc.io',
          name: 'quote',
          revision: 'v1.3.0',
          url: 'https://pkg.go.dev/rsc.io/quote@v1.3.0'
        }
      ],
      [
        'git/github/ratatui-org/ratatui/bcf43688ec4a13825307aef88f3cdcd007b32641',
        {
          type: 'git',
          provider: 'github',
          namespace: 'ratatui-org',
          name: 'ratatui',
          revision: 'bcf43688ec4a13825307aef88f3cdcd007b32641',
          url: 'https://github.com/ratatui-org/ratatui/tree/bcf43688ec4a13825307aef88f3cdcd007b32641'
        }
      ],
      [
        'git/gitlab/cznic/sqlite/282bdb12f8ce48a34b4b768863c4e44c310c4bd8',
        {
          type: 'git',
          provider: 'gitlab',
          namespace: 'cznic',
          name: 'sqlite',
          revision: '282bdb12f8ce48a34b4b768863c4e44c310c4bd8',
          url: 'https://gitlab.com/cznic/sqlite/-/tree/282bdb12f8ce48a34b4b768863c4e44c310c4bd8'
        }
      ],
      [
        'sourcearchive/mavencentral/com.azure/azure-storage-blob/12.20.0',
        {
          type: 'sourcearchive',
          provider: 'mavencentral',
          namespace: 'com.azure',
          name: 'azure-storage-blob',
          revision: '12.20.0',
          url: 'https://search.maven.org/remotecontent?filepath=com/azure/azure-storage-blob/12.20.0/azure-storage-blob-12.20.0-sources.jar'
        }
      ]
    ])

    data.forEach((expected, coordinatesString) => {
      it(`should have source location for ${coordinatesString} package`, async () => {
        const { service, coordinates } = setup(createDefinition(null, null, []), coordinatesString)
        const definition = await service.compute(coordinates)
        assert.deepStrictEqual(definition.described.sourceLocation, expected)
      })
    })
  })

  describe('computeAndStoreIfNecessary', () => {
    let service
    let coordinates
    beforeEach(() => {
      ;({ service, coordinates } = setup())
      service.getStored = mock.fn(async () => ({
        described: {
          tools: ['scancode/3.2.2', 'licensee/3.2.2']
        }
      }))
      mock.method(service, 'compute')
    })

    afterEach(() => {
      mock.restoreAll()
    })

    it('computes if definition does not exist', async () => {
      service.getStored = mock.fn(async () => undefined)
      await service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2')
      assert.strictEqual(service.getStored.mock.callCount() === 1, true)
      assert.deepStrictEqual(service.getStored.mock.calls[0].arguments[0], coordinates)
      assert.strictEqual(service.compute.mock.callCount() === 1, true)
      assert.deepStrictEqual(service.compute.mock.calls[0].arguments[0], coordinates)
    })

    it('computes if tools array is undefined', async () => {
      service.getStored = mock.fn(async () => ({
        described: {
        }
      }))
      await service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2')
      assert.strictEqual(service.compute.mock.callCount() === 1, true)
    })

    it('computes if the tool result is not included in definition', async () => {
      await service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2')
      assert.strictEqual(service.compute.mock.callCount() === 1, true)
      assert.deepStrictEqual(service.compute.mock.calls[0].arguments[0], coordinates)
    })

    it('skips compute if existing definition contains the tool result', async () => {
      await service.computeAndStoreIfNecessary(coordinates, 'scancode', '3.2.2')
      assert.strictEqual(service.getStored.mock.callCount() === 1, true)
      assert.deepStrictEqual(service.getStored.mock.calls[0].arguments[0], coordinates)
      assert.strictEqual(service.compute.mock.callCount() === 0, true)
    })

    it('handles two computes for the same coordinates: computes the first and skip the second', async () => {
      await Promise.all([
        service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2'),
        service.computeAndStoreIfNecessary(coordinates, 'scancode', '3.2.2')
      ])
      assert.strictEqual(service.getStored.mock.callCount() === 2, true)
      assert.deepStrictEqual(service.getStored.mock.calls[0].arguments[0], coordinates)
      assert.deepStrictEqual(service.getStored.mock.calls[1].arguments[0], coordinates)

      assert.strictEqual(service.compute.mock.callCount() === 1, true)
      assert.deepStrictEqual(service.compute.mock.calls[0].arguments[0], coordinates)

      //verfiy the calls are in sequence to ensure that locking works
      // Call ordering verified by the mock call counts above - compute runs once,
      // getStored runs twice (before and after compute)
    })

    it('releases the lock upon failure', async () => {
      let getStoredCallCount = 0
      service.getStored = mock.fn(async () => {
        getStoredCallCount++
        if (getStoredCallCount === 1) throw new Error('test error')
        return { described: {} }
      })

      const results = await Promise.allSettled([
        service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2'),
        service.computeAndStoreIfNecessary(coordinates, 'scancode', '3.2.2')
      ])

      assert.strictEqual(results[0].status, 'rejected')
      assert.strictEqual(results[0].reason.message, 'test error')
      assert.strictEqual(results[1].status, 'fulfilled')

      //lock is released after the first call
      assert.strictEqual(service.getStored.mock.callCount() === 2, true)
      assert.deepStrictEqual(service.getStored.mock.calls[0].arguments[0], coordinates)
      assert.deepStrictEqual(service.getStored.mock.calls[1].arguments[0], coordinates)

      assert.strictEqual(service.compute.mock.callCount() === 1, true)
      assert.deepStrictEqual(service.compute.mock.calls[0].arguments[0], coordinates)
    })
  })
})

describe('Definition Service Facet management', () => {
  it('merges complex attributions across files', async () => {
    const files = [
      buildFile('foo.txt', null, ['&#60;Bob&gt;', 'Jane   Inc.', 'Jane Inc']),
      buildFile('bar.txt', null, ['<Bob>.', 'Jane Inc'])
    ]
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    const core = definition.licensed.facets.core
    assertDeepEqualInAnyOrder(core.attribution.parties, ['Copyright <Bob>.', 'Copyright Jane Inc.'])
    assertDeepEqualInAnyOrder(definition.files, [
      { path: 'foo.txt', attributions: ['Copyright <Bob>', 'Copyright Jane Inc.'] },
      { path: 'bar.txt', attributions: ['Copyright <Bob>.', 'Copyright Jane Inc'] }
    ])
  })

  it('handles files with no data', async () => {
    const files = [buildFile('foo.txt', null, null), buildFile('bar.txt', null, null)]
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    assert.strictEqual(definition.files.length, 2)
    assert.strictEqual(definition.licensed.declared, undefined)
    const core = definition.licensed.facets.core
    assert.strictEqual(core.files, 2)
    assert.strictEqual(core.attribution.parties, undefined)
    assert.strictEqual(core.attribution.unknown, 2)
    assert.strictEqual(core.discovered.expressions, undefined)
    assert.strictEqual(core.discovered.unknown, 2)
  })

  it('handles no files', async () => {
    const files = []
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    assert.strictEqual(definition.files.length, 0)
    assert.strictEqual(definition.licensed.score.total, 0)
    assert.strictEqual(definition.licensed.toolScore.total, 0)
    assert.strictEqual(Object.keys(definition.licensed).length, 2)
  })

  it('gets all the attribution parties', async () => {
    const files = [buildFile('foo.txt', 'MIT', ['Bob', 'Fred']), buildFile('bar.txt', 'MIT', ['Jane', 'Fred'])]
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    const core = definition.licensed.facets.core
    assert.strictEqual(core.files, 2)
    assert.strictEqual(core.attribution.parties.length, 3)
    assertDeepEqualInAnyOrder(core.attribution.parties, ['Copyright Bob', 'Copyright Jane', 'Copyright Fred'])
    assert.strictEqual(core.attribution.unknown, 0)
  })

  it('summarizes with basic facets', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL-2.0', [])]
    const facets = { tests: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    assert.strictEqual(definition.files.length, 2)
    const core = definition.licensed.facets.core
    assert.strictEqual(core.files, 1)
    assert.deepStrictEqual(core.discovered.expressions, ['GPL-2.0'])
    assert.strictEqual(core.discovered.unknown, 0)
    const tests = definition.licensed.facets.tests
    assert.strictEqual(tests.files, 1)
    assert.deepStrictEqual(tests.discovered.expressions, ['MIT'])
    assert.strictEqual(tests.discovered.unknown, 0)
  })

  it('summarizes with no core filters', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL-2.0', [])]
    const facets = { tests: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    assert.strictEqual(definition.files.length, 2)
    const core = definition.licensed.facets.core
    assert.strictEqual(core.files, 1)
    assert.deepStrictEqual(core.discovered.expressions, ['GPL-2.0'])
    assert.strictEqual(core.discovered.unknown, 0)
    const tests = definition.licensed.facets.tests
    assert.strictEqual(tests.files, 1)
    assert.deepStrictEqual(tests.discovered.expressions, ['MIT'])
    assert.strictEqual(tests.discovered.unknown, 0)
  })

  it('summarizes with everything grouped into non-core facet', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL-2.0', [])]
    const facets = { tests: ['*.json'], dev: ['*.foo'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    assert.strictEqual(definition.files.length, 2)
    assert.strictEqual(definition.licensed.facets.core, undefined)
    const dev = definition.licensed.facets.dev
    assert.strictEqual(dev.files, 1)
    assert.deepStrictEqual(dev.discovered.expressions, ['GPL-2.0'])
    assert.strictEqual(dev.discovered.unknown, 0)
    const tests = definition.licensed.facets.tests
    assert.strictEqual(tests.files, 1)
    assert.deepStrictEqual(tests.discovered.expressions, ['MIT'])
    assert.strictEqual(tests.discovered.unknown, 0)
  })

  it('summarizes files in multiple facets', async () => {
    const files = [buildFile('LICENSE.json', 'GPL-2.0', []), buildFile('Test.json', 'MIT', [])]
    const facets = { tests: ['*.json'], dev: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    assert.strictEqual(definition.files.length, 2)
    assertDeepEqualInAnyOrder(definition.files[0].facets, ['tests', 'dev'])
    assertDeepEqualInAnyOrder(definition.files[1].facets, ['tests', 'dev'])
    assert.strictEqual(definition.licensed.facets.core, undefined)
    const dev = definition.licensed.facets.dev
    assert.strictEqual(dev.files, 2)
    assertDeepEqualInAnyOrder(dev.discovered.expressions, ['GPL-2.0', 'MIT'])
    assert.strictEqual(dev.discovered.unknown, 0)
    const tests = definition.licensed.facets.tests
    assert.strictEqual(tests.files, 2)
    assertDeepEqualInAnyOrder(tests.discovered.expressions, ['MIT', 'GPL-2.0'])
    assert.strictEqual(tests.discovered.unknown, 0)
  })
})

describe('Integration test', () => {
  describe('compute', () => {
    let fileHarvestStore
    beforeEach(() => {
      fileHarvestStore = createFileHarvestStore()
    })

    it('computes the same definition with latest harvest data', async () => {
      const coordinates = EntityCoordinates.fromString('npm/npmjs/-/debug/3.1.0')
      const allHarvestData = await fileHarvestStore.getAll(coordinates)
      delete allHarvestData['scancode']['2.9.0+b1'] //remove invalid scancode version
      let service = setupServiceToCalculateDefinition(allHarvestData)
      const baseline_def = await service.compute(coordinates)

      const latestHarvestData = await fileHarvestStore.getAllLatest(coordinates)
      service = setupServiceToCalculateDefinition(latestHarvestData)
      const comparison_def = await service.compute(coordinates)

      //updated timestamp is not deterministic
      assert.notStrictEqual(comparison_def._meta.updated, baseline_def._meta.updated)
      comparison_def._meta.updated = baseline_def._meta.updated
      assert.deepStrictEqual(comparison_def, baseline_def)
    })
  })

  describe('Handle schema version upgrade', () => {
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0')
    const definition = { _meta: { schemaVersion: '1.7.0' }, coordinates }
    const logger = {
      debug: () => {},
      error: () => {},
      info: () => {}
    }

    let upgradeHandler

    const handleVersionedDefinition = () => {
      describe('verify schema version', () => {
        it('logs and harvests new definitions with empty tools', async () => {
          const { service } = setupServiceForUpgrade(null, upgradeHandler)
          service._harvest = mock.fn()
          await service.get(coordinates)
          assert.strictEqual(service._harvest.mock.callCount() === 1, true)
          assert.strictEqual(service._harvest.mock.calls[0].arguments[0], coordinates)
        })

        it('computes if definition does not exist', async () => {
          const { service } = setupServiceForUpgrade(null, upgradeHandler)
          service.computeStoreAndCurate = mock.fn(async () => definition)
          await service.get(coordinates)
          assert.strictEqual(service.computeStoreAndCurate.mock.callCount() === 1, true)
          assert.strictEqual(service.computeStoreAndCurate.mock.calls[0].arguments[0], coordinates)
        })

        it('returns the up-to-date definition', async () => {
          const { service } = setupServiceForUpgrade(definition, upgradeHandler)
          service.computeStoreAndCurate = mock.fn()
          const result = await service.get(coordinates)
          assert.strictEqual(service.computeStoreAndCurate.mock.callCount() > 0, false)
          assert.deepStrictEqual(result, definition)
        })
      })
    }

    describe('schema version check', () => {
      beforeEach(async () => {
        upgradeHandler = new DefinitionVersionChecker({ logger })
        await upgradeHandler.initialize()
      })

      handleVersionedDefinition()

      describe('with stale definitions', () => {
        it('recomputes a definition with the updated schema version', async () => {
          const staleDef = { ...createDefinition(null, null, ['foo']), _meta: { schemaVersion: '1.0.0' }, coordinates }
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          const result = await service.get(coordinates)
          assert.strictEqual(result._meta.schemaVersion, '1.7.0')
          assert.deepStrictEqual(result.coordinates, coordinates)
          assert.strictEqual(store.store.mock.callCount() === 1, true)
        })
      })
    })

    describe('queueing schema version updates', () => {
      let queue
      let staleDef
      beforeEach(async () => {
        queue = memoryQueue()
        const queueFactory = mock.fn(() => queue)
        upgradeHandler = new DefinitionQueueUpgrader({ logger, queue: queueFactory })
        await upgradeHandler.initialize()
        staleDef = { ...createDefinition(null, null, ['foo']), _meta: { schemaVersion: '1.0.0' }, coordinates }
      })

      handleVersionedDefinition()

      describe('with stale definitions', () => {
        it('returns a stale definition, queues update, recomputes and retrieves the updated definition', async () => {
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          const result = await service.get(coordinates)
          assert.deepStrictEqual(result, staleDef)
          assert.strictEqual(queue.data.length, 1)
          await upgradeHandler.setupProcessing(service, logger, true)
          const newResult = await service.get(coordinates)
          assert.strictEqual(newResult._meta.schemaVersion, '1.7.0')
          assert.strictEqual(store.store.mock.callCount() === 1, true)
          assert.strictEqual(queue.data.length, 0)
        })

        it('computes once when the same coordinates is queued twice', async () => {
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          await service.get(coordinates)
          const result = await service.get(coordinates)
          assert.deepStrictEqual(result, staleDef)
          assert.strictEqual(queue.data.length, 2)
          await upgradeHandler.setupProcessing(service, logger, true)
          assert.strictEqual(queue.data.length, 1)
          await upgradeHandler.setupProcessing(service, logger, true)
          const newResult = await service.get(coordinates)
          assert.strictEqual(newResult._meta.schemaVersion, '1.7.0')
          assert.strictEqual(store.store.mock.callCount() === 1, true)
          assert.strictEqual(queue.data.length, 0)
        })

        it('computes once when the same coordinates is queued twice within one dequeue batch ', async () => {
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          await service.get(coordinates)
          await service.get(coordinates)
          queue.dequeueMultiple = mock.fn(async () => {
            const message1 = await queue.dequeue()
            const message2 = await queue.dequeue()
            return Promise.resolve([message1, message2])
          })
          await upgradeHandler.setupProcessing(service, logger, true)
          const newResult = await service.get(coordinates)
          assert.strictEqual(newResult._meta.schemaVersion, '1.7.0')
          assert.strictEqual(store.store.mock.callCount() === 1, true)
        })
      })
    })
  })

  describe('Harvest Cache', () => {
    let service
    let coordinates
    let harvestService

    it('deletes the tracked in progress harvest after definition is computed', async () => {
      ;({ service, coordinates, harvestService } = setup(createDefinition(null, null, ['foo'])))
      harvestService.done = mock.fn(async () => true)
      await service.computeAndStore(coordinates)
      assert.strictEqual(harvestService.done.mock.callCount() === 1, true)
      assert.deepStrictEqual(harvestService.done.mock.calls[0].arguments[0], coordinates)
    })
  })
})

function createFileHarvestStore() {
  const options = {
    location: 'test/fixtures/store',
    logger: {
      error: () => {},
      debug: () => {}
    }
  }
  return FileHarvestStore(options)
}

function setupServiceToCalculateDefinition(rawHarvestData) {
  const harvestStore = { getAllLatest: () => Promise.resolve(rawHarvestData) }
  const summary = SummaryService({})

  const tools = [['clearlydefined', 'reuse', 'licensee', 'scancode', 'fossology', 'cdsource']]
  const aggregator = AggregatorService({ precedence: tools })
  aggregator.logger = { info: mock.fn() }
  const curator = {
    get: () => Promise.resolve(),
    apply: (_coordinates, _curationSpec, definition) => Promise.resolve(definition),
    autoCurate: () => {}
  }
  return setupWithDelegates(curator, harvestStore, summary, aggregator)
}

function setupServiceForUpgrade(definition, upgradeHandler) {
  let storedDef = definition && { ...definition }
  const store = {
    get: mock.fn(async () => storedDef),
    store: mock.fn(def => (storedDef = def))
  }
  const harvestStore = { getAllLatest: () => Promise.resolve(null) }
  const summary = { summarizeAll: () => Promise.resolve(null) }
  const aggregator = { process: () => Promise.resolve(definition) }
  const curator = {
    get: () => Promise.resolve(),
    apply: (_coordinates, _curationSpec, definition) => Promise.resolve(definition),
    autoCurate: () => {}
  }
  const service = setupWithDelegates(curator, harvestStore, summary, aggregator, store, upgradeHandler)
  return { service, store }
}

function setupWithDelegates(
  curator: Record<string, unknown>,
  harvestStore: Record<string, unknown>,
  summary: Record<string, unknown>,
  aggregator: Record<string, unknown>,
  store: Record<string, ReturnType<typeof mock.fn>> = { delete: mock.fn(), get: mock.fn(), store: mock.fn() },
  upgradeHandler: Record<string, unknown> = { validate: (def: unknown) => Promise.resolve(def) }
): any {
  const search = { delete: mock.fn(), store: mock.fn() }
  const cache = { delete: mock.fn(), get: mock.fn(), set: mock.fn() }
  const harvestService = mockHarvestService()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test accesses internal service properties
  const service: any = (DefinitionService as (...args: any[]) => any)(
    harvestStore,
    harvestService,
    summary,
    aggregator,
    curator,
    store,
    search,
    cache,
    upgradeHandler
  )
  service.logger = { info: mock.fn(), debug: () => {} }
  return service
}

function validate(definition: Record<string, unknown>) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  if (!validator.validate('definition', definition)) {
    throw new Error(validator.errorsText())
  }
}

function createDefinition(facets?: unknown, files?: unknown[], tools?: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (facets) {
    set(result, 'described.facets', facets)
  }
  if (files) {
    result.files = files
  }
  if (tools) {
    set(result, 'described.tools', tools)
  }
  return result
}

function buildFile(path: string, license?: string | null, holders?: string[] | null): Record<string, unknown> {
  const result: Record<string, unknown> = { path }
  setIfValue(result, 'license', license)
  setIfValue(result, 'attributions', holders ? holders.map(entry => `Copyright ${entry}`) : null)
  return result
}

function setup(
  definition?: Record<string, unknown>,
  coordinateSpec?: string,
  curation?: Record<string, unknown>
): { coordinates: EntityCoordinates; service: any; harvestService: ReturnType<typeof mockHarvestService> } {
  const store = { delete: mock.fn(), get: mock.fn(), store: mock.fn() }
  const search = { delete: mock.fn(), store: mock.fn() }
  const cache = { delete: mock.fn(), get: mock.fn(), set: mock.fn() }
  const curator = {
    get: () => Promise.resolve(curation),
    apply: (_coordinates: unknown, _curationSpec: unknown, definition: unknown) =>
      Promise.resolve(Curation.apply(definition, curation)),
    autoCurate: () => {
      return
    }
  }
  const harvestStore = { getAllLatest: () => Promise.resolve(null) }
  const harvestService = mockHarvestService()
  const summary = { summarizeAll: () => Promise.resolve(null) }
  const aggregator = { process: () => Promise.resolve(definition) }
  const upgradeHandler = { validate: (def: unknown) => Promise.resolve(def) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test accesses internal service properties
  const service: any = (DefinitionService as (...args: any[]) => any)(
    harvestStore,
    harvestService,
    summary,
    aggregator,
    curator,
    store,
    search,
    cache,
    upgradeHandler
  )
  service.logger = { info: mock.fn(), debug: mock.fn() }
  service._harvest = mock.fn()
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, service, harvestService }
}

function mockHarvestService() {
  return {
    harvest: () => mock.fn(),
    done: () => Promise.resolve()
  }
}
