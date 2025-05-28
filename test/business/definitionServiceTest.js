// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const validator = require('../../schemas/validator')
const DefinitionService = require('../../business/definitionService')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { setIfValue } = require('../../lib/utils')
const Curation = require('../../lib/curation')
const { set } = require('lodash')
const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
chai.use(deepEqualInAnyOrder)
const expect = chai.expect
const FileHarvestStore = require('../../providers/stores/fileHarvestStore')
const SummaryService = require('../../business/summarizer')
const AggregatorService = require('../../business/aggregator')
const DefinitionQueueUpgrader = require('../../providers/upgrade/defUpgradeQueue')
const memoryQueue = require('../../providers/upgrade/memoryQueueConfig')
const { DefinitionVersionChecker } = require('../../providers/upgrade/defVersionCheck')

describe('Definition Service', () => {
  it('invalidates single coordinate', async () => {
    const { service, coordinates } = setup()
    await service.invalidate(coordinates)
    expect(service.definitionStore.delete.calledOnce).to.be.true
    expect(service.definitionStore.delete.getCall(0).args[0].name).to.be.eq('test')
    expect(service.cache.delete.calledOnce).to.be.true
    expect(service.cache.delete.getCall(0).args[0]).to.be.eq('def_npm/npmjs/-/test/1.0')
  })

  it('invalidates array of coordinates', async () => {
    const { service } = setup()
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3')
    ]
    await service.invalidate(coordinates)
    expect(service.definitionStore.delete.calledTwice).to.be.true
    expect(service.cache.delete.calledTwice).to.be.true
    expect(service.definitionStore.delete.getCall(0).args[0].name).to.be.eq('test0')
    expect(service.definitionStore.delete.getCall(1).args[0].name).to.be.eq('test1')
    expect(service.cache.delete.getCall(0).args[0]).to.be.eq('def_npm/npmjs/-/test0/2.3')
    expect(service.cache.delete.getCall(1).args[0]).to.be.eq('def_npm/npmjs/-/test1/2.3')
  })

  it('does not store empty definitions', async () => {
    const { service, coordinates } = setup(createDefinition())
    await service.get(coordinates)
    expect(service.definitionStore.store.notCalled).to.be.true
    expect(service.search.store.notCalled).to.be.true
  })

  it('stores new definitions', async () => {
    const { service, coordinates } = setup(createDefinition(null, null, ['foo']))
    await service.get(coordinates)
    expect(service.definitionStore.store.calledOnce).to.be.true
    expect(service.search.store.notCalled).to.be.true
  })

  it('trims files from definitions', async () => {
    const { service, coordinates } = setup(createDefinition(null, [{ path: 'path/to/file' }], ['foo']))
    const definition = await service.get(coordinates, null, null, '-files')
    expect(definition.files).to.be.undefined
    const fullDefinition = await service.get(coordinates)
    expect(fullDefinition.files).to.deep.eq([{ path: 'path/to/file' }])
  })

  it('logs and harvest new definitions with empty tools', async () => {
    const { service, coordinates } = setup(createDefinition(null, null, []))
    await service.get(coordinates)
    // expect(service.logger.info.calledOnce).to.be.true
    // expect(service.logger.info.getCall(0).args[0]).to.eq('definition not available')
    expect(service._harvest.calledOnce).to.be.true
    expect(service._harvest.getCall(0).args[0]).to.eq(coordinates)
  })

  it('logs and harvests new definitions with undefined tools', async () => {
    const { service, coordinates } = setup(createDefinition(null, null, undefined))
    await service.get(coordinates)
    // expect(service.logger.info.calledOnce).to.be.true
    // expect(service.logger.info.getCall(0).args[0]).to.eq('definition not available')
    expect(service._harvest.calledOnce).to.be.true
    expect(service._harvest.getCall(0).args[0]).to.eq(coordinates)
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
    expect(definition.described.score.total).to.eq(30)
    expect(definition.described.toolScore.total).to.eq(0)
    expect(definition.licensed.score.total).to.eq(85)
    expect(definition.licensed.toolScore.total).to.eq(0)
    expect(definition.scores.effective).to.eq(57) // floor(85+30/2)
    expect(definition.scores.tool).to.eq(0)
  })

  it('lists all coordinates found', async () => {
    const { service } = setup()
    service.definitionStore.list = coordinates => {
      coordinates.revision = '2.3'
      if (coordinates.name === 'missing') return Promise.resolve([])
      return Promise.resolve([coordinates.toString().toLowerCase()])
    }
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/testUpperCase/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/missing/2.3')
    ]
    const result = await service.listAll(coordinates)
    expect(result.length).to.eq(3)
    expect(result.map(x => x.name)).to.have.members(['test0', 'test1', 'testUpperCase'])
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
        expect(definition.described.sourceLocation).to.be.deep.equal(expected)
      })
    })
  })

  describe('computeAndStoreIfNecessary', () => {
    let service, coordinates
    beforeEach(() => {
      ;({ service, coordinates } = setup())
      service.getStored = sinon.stub().resolves({
        described: {
          tools: ['scancode/3.2.2', 'licensee/3.2.2']
        }
      })
      sinon.spy(service, 'compute')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('computes if definition does not exist', async () => {
      service.getStored = sinon.stub().resolves(undefined)
      await service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2')
      expect(service.getStored.calledOnce).to.be.true
      expect(service.getStored.getCall(0).args[0]).to.deep.eq(coordinates)
      expect(service.compute.calledOnce).to.be.true
      expect(service.compute.getCall(0).args[0]).to.deep.eq(coordinates)
    })

    it('computes if tools array is undefined', async () => {
      service.getStored = sinon.stub().resolves({ described: {} })
      await service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2')
      expect(service.compute.calledOnce).to.be.true
    })

    it('computes if the tool result is not included in definition', async () => {
      await service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2')
      expect(service.compute.calledOnce).to.be.true
      expect(service.compute.getCall(0).args[0]).to.deep.eq(coordinates)
    })

    it('skips compute if existing definition contains the tool result', async () => {
      await service.computeAndStoreIfNecessary(coordinates, 'scancode', '3.2.2')
      expect(service.getStored.calledOnce).to.be.true
      expect(service.getStored.getCall(0).args[0]).to.deep.eq(coordinates)
      expect(service.compute.notCalled).to.be.true
    })

    it('handles two computes for the same coordinates: computes the first and skip the second', async () => {
      await Promise.all([
        service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2'),
        service.computeAndStoreIfNecessary(coordinates, 'scancode', '3.2.2')
      ])
      expect(service.getStored.calledTwice).to.be.true
      expect(service.getStored.getCall(0).args[0]).to.deep.eq(coordinates)
      expect(service.getStored.getCall(1).args[0]).to.deep.eq(coordinates)

      expect(service.compute.calledOnce).to.be.true
      expect(service.compute.getCall(0).args[0]).to.deep.eq(coordinates)

      //verfiy the calls are in sequence to ensure that locking works
      expect(service.compute.getCall(0).calledAfter(service.getStored.getCall(0))).to.be.true
      expect(service.compute.getCall(0).calledBefore(service.getStored.getCall(1))).to.be.true
    })

    it('releases the lock upon failure', async () => {
      service.getStored = sinon
        .stub()
        .onFirstCall()
        .rejects(new Error('test error'))
        .onSecondCall()
        .resolves({ described: {} })

      const results = await Promise.allSettled([
        service.computeAndStoreIfNecessary(coordinates, 'reuse', '3.2.2'),
        service.computeAndStoreIfNecessary(coordinates, 'scancode', '3.2.2')
      ])

      expect(results[0].status).to.eq('rejected')
      expect(results[0].reason.message).to.eq('test error')
      expect(results[1].status).to.eq('fulfilled')

      //lock is released after the first call
      expect(service.getStored.calledTwice).to.be.true
      expect(service.getStored.getCall(0).args[0]).to.deep.eq(coordinates)
      expect(service.getStored.getCall(1).args[0]).to.deep.eq(coordinates)

      expect(service.compute.calledOnce).to.be.true
      expect(service.compute.getCall(0).args[0]).to.deep.eq(coordinates)
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
    expect(core.attribution.parties).to.deep.equalInAnyOrder(['Copyright <Bob>.', 'Copyright Jane Inc.'])
    expect(definition.files).to.deep.equalInAnyOrder([
      { path: 'foo.txt', attributions: ['Copyright <Bob>', 'Copyright Jane Inc.'] },
      { path: 'bar.txt', attributions: ['Copyright <Bob>.', 'Copyright Jane Inc'] }
    ])
  })

  it('handles files with no data', async () => {
    const files = [buildFile('foo.txt', null, null), buildFile('bar.txt', null, null)]
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    expect(definition.licensed.declared).to.be.undefined
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.attribution.parties).to.be.undefined
    expect(core.attribution.unknown).to.eq(2)
    expect(core.discovered.expressions).to.be.undefined
    expect(core.discovered.unknown).to.eq(2)
  })

  it('handles no files', async () => {
    const files = []
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(0)
    expect(definition.licensed.score.total).to.eq(0)
    expect(definition.licensed.toolScore.total).to.eq(0)
    expect(Object.keys(definition.licensed).length).to.eq(2)
  })

  it('gets all the attribution parties', async () => {
    const files = [buildFile('foo.txt', 'MIT', ['Bob', 'Fred']), buildFile('bar.txt', 'MIT', ['Jane', 'Fred'])]
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.attribution.parties.length).to.eq(3)
    expect(core.attribution.parties).to.deep.equalInAnyOrder(['Copyright Bob', 'Copyright Jane', 'Copyright Fred'])
    expect(core.attribution.unknown).to.eq(0)
  })

  it('summarizes with basic facets', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL-2.0', [])]
    const facets = { tests: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['GPL-2.0'])
    expect(core.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes with no core filters', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL-2.0', [])]
    const facets = { tests: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['GPL-2.0'])
    expect(core.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes with everything grouped into non-core facet', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL-2.0', [])]
    const facets = { tests: ['*.json'], dev: ['*.foo'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    expect(definition.licensed.facets.core).to.be.undefined
    const dev = definition.licensed.facets.dev
    expect(dev.files).to.eq(1)
    expect(dev.discovered.expressions).to.deep.eq(['GPL-2.0'])
    expect(dev.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes files in multiple facets', async () => {
    const files = [buildFile('LICENSE.json', 'GPL-2.0', []), buildFile('Test.json', 'MIT', [])]
    const facets = { tests: ['*.json'], dev: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    expect(definition.files[0].facets).to.deep.equalInAnyOrder(['tests', 'dev'])
    expect(definition.files[1].facets).to.deep.equalInAnyOrder(['tests', 'dev'])
    expect(definition.licensed.facets.core).to.be.undefined
    const dev = definition.licensed.facets.dev
    expect(dev.files).to.eq(2)
    expect(dev.discovered.expressions).to.deep.equalInAnyOrder(['GPL-2.0', 'MIT'])
    expect(dev.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(2)
    expect(tests.discovered.expressions).to.deep.equalInAnyOrder(['MIT', 'GPL-2.0'])
    expect(tests.discovered.unknown).to.eq(0)
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
      expect(comparison_def._meta.updated).to.not.equal(baseline_def._meta.updated)
      comparison_def._meta.updated = baseline_def._meta.updated
      expect(comparison_def).to.deep.equal(baseline_def)
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

    const handleVersionedDefinition = function () {
      describe('verify schema version', () => {
        it('logs and harvests new definitions with empty tools', async () => {
          const { service } = setupServiceForUpgrade(null, upgradeHandler)
          service._harvest = sinon.stub()
          await service.get(coordinates)
          expect(service._harvest.calledOnce).to.be.true
          expect(service._harvest.getCall(0).args[0]).to.eq(coordinates)
        })

        it('computes if definition does not exist', async () => {
          const { service } = setupServiceForUpgrade(null, upgradeHandler)
          service.computeStoreAndCurate = sinon.stub().resolves(definition)
          await service.get(coordinates)
          expect(service.computeStoreAndCurate.calledOnce).to.be.true
          expect(service.computeStoreAndCurate.getCall(0).args[0]).to.eq(coordinates)
        })

        it('returns the up-to-date definition', async () => {
          const { service } = setupServiceForUpgrade(definition, upgradeHandler)
          service.computeStoreAndCurate = sinon.stub()
          const result = await service.get(coordinates)
          expect(service.computeStoreAndCurate.called).to.be.false
          expect(result).to.deep.equal(definition)
        })
      })
    }

    describe('schema version check', () => {
      beforeEach(async () => {
        upgradeHandler = new DefinitionVersionChecker({ logger })
        await upgradeHandler.initialize()
      })

      handleVersionedDefinition()

      context('with stale definitions', () => {
        it('recomputes a definition with the updated schema version', async () => {
          const staleDef = { ...createDefinition(null, null, ['foo']), _meta: { schemaVersion: '1.0.0' }, coordinates }
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          const result = await service.get(coordinates)
          expect(result._meta.schemaVersion).to.eq('1.7.0')
          expect(result.coordinates).to.deep.equal(coordinates)
          expect(store.store.calledOnce).to.be.true
        })
      })
    })

    describe('queueing schema version updates', () => {
      let queue, staleDef
      beforeEach(async () => {
        queue = memoryQueue()
        const queueFactory = sinon.stub().returns(queue)
        upgradeHandler = new DefinitionQueueUpgrader({ logger, queue: queueFactory })
        await upgradeHandler.initialize()
        staleDef = { ...createDefinition(null, null, ['foo']), _meta: { schemaVersion: '1.0.0' }, coordinates }
      })

      handleVersionedDefinition()

      context('with stale definitions', () => {
        it('returns a stale definition, queues update, recomputes and retrieves the updated definition', async () => {
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          const result = await service.get(coordinates)
          expect(result).to.deep.equal(staleDef)
          expect(queue.data.length).to.eq(1)
          await upgradeHandler.setupProcessing(service, logger, true)
          const newResult = await service.get(coordinates)
          expect(newResult._meta.schemaVersion).to.eq('1.7.0')
          expect(store.store.calledOnce).to.be.true
          expect(queue.data.length).to.eq(0)
        })

        it('computes once when the same coordinates is queued twice', async () => {
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          await service.get(coordinates)
          const result = await service.get(coordinates)
          expect(result).to.deep.equal(staleDef)
          expect(queue.data.length).to.eq(2)
          await upgradeHandler.setupProcessing(service, logger, true)
          expect(queue.data.length).to.eq(1)
          await upgradeHandler.setupProcessing(service, logger, true)
          const newResult = await service.get(coordinates)
          expect(newResult._meta.schemaVersion).to.eq('1.7.0')
          expect(store.store.calledOnce).to.be.true
          expect(queue.data.length).to.eq(0)
        })

        it('computes once when the same coordinates is queued twice within one dequeue batch ', async () => {
          const { service, store } = setupServiceForUpgrade(staleDef, upgradeHandler)
          await service.get(coordinates)
          await service.get(coordinates)
          queue.dequeueMultiple = sinon.stub().callsFake(async () => {
            const message1 = await queue.dequeue()
            const message2 = await queue.dequeue()
            return Promise.resolve([message1, message2])
          })
          await upgradeHandler.setupProcessing(service, logger, true)
          const newResult = await service.get(coordinates)
          expect(newResult._meta.schemaVersion).to.eq('1.7.0')
          expect(store.store.calledOnce).to.be.true
        })
      })
    })
  })

  describe('Placeholder definition and Cache', () => {
    let service, coordinates, harvestService

    describe('placeholder definition', () => {
      beforeEach(() => {
        ;({ service, coordinates, harvestService } = setup(createDefinition(null, null, null)))
        sinon.spy(service, 'compute')
        sinon.spy(service, '_computePlaceHolder')
        sinon.spy(harvestService, 'isTracked')
      })

      it('returns a placeholder definition same as computed', async () => {
        const computed = await service.get(coordinates)
        const placeholder = service._computePlaceHolder(coordinates)
        placeholder._meta.updated = 'ignore_time_stamp'
        computed._meta.updated = 'ignore_time_stamp'
        expect(placeholder).to.deep.equal(computed)
      })

      it('triggers a harvest for a new component', async () => {
        harvestService.isTracked = sinon.stub().resolves(false)
        await service.get(coordinates)
        expect(service.compute.called).to.be.true
        expect(service._harvest.called).to.be.true
        expect(service._computePlaceHolder.calledOnce).to.be.false
        expect(harvestService.isTracked.calledOnce).to.be.true
        expect(harvestService.isTracked.args[0][0]).to.be.deep.equal(coordinates)
      })

      it('returns a placeholder definition with a tracked harvest', async () => {
        harvestService.isTracked = sinon.stub().resolves(true)
        await service.get(coordinates)
        expect(service._computePlaceHolder.calledOnce).to.be.true
        expect(service.compute.called).to.be.false
        expect(service._harvest.called).to.be.false
        expect(harvestService.isTracked.calledOnce).to.be.true
        expect(harvestService.isTracked.args[0][0]).to.be.deep.equal(coordinates)
      })
    })

    it('deletes the tracked in progress harvest after definition is computed', async () => {
      ;({ service, coordinates, harvestService } = setup(createDefinition(null, null, ['foo'])))
      harvestService.done = sinon.stub().resolves(true)
      await service.computeAndStore(coordinates)
      expect(harvestService.done.calledOnce).to.be.true
      expect(harvestService.done.args[0][0]).to.be.deep.equal(coordinates)
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
  aggregator.logger = { info: sinon.stub() }
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
    get: sinon.stub().resolves(storedDef),
    store: sinon.stub().callsFake(def => (storedDef = def))
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
  curator,
  harvestStore,
  summary,
  aggregator,
  store = { delete: sinon.stub(), get: sinon.stub(), store: sinon.stub() },
  upgradeHandler = { validate: def => Promise.resolve(def) }
) {
  const search = { delete: sinon.stub(), store: sinon.stub() }
  const cache = { delete: sinon.stub(), get: sinon.stub(), set: sinon.stub() }
  const harvestService = mockHarvestService()
  const service = DefinitionService(
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
  service.logger = { info: sinon.stub(), debug: () => {} }
  return service
}

function validate(definition) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  if (!validator.validate('definition', definition)) throw new Error(validator.errorsText())
}

function createDefinition(facets, files, tools) {
  const result = {}
  if (facets) set(result, 'described.facets', facets)
  if (files) result.files = files
  if (tools) set(result, 'described.tools', tools)
  return result
}

function buildFile(path, license, holders) {
  const result = { path }
  setIfValue(result, 'license', license)
  setIfValue(result, 'attributions', holders ? holders.map(entry => `Copyright ${entry}`) : null)
  return result
}

function setup(definition, coordinateSpec, curation) {
  const store = { delete: sinon.stub(), get: sinon.stub(), store: sinon.stub() }
  const search = { delete: sinon.stub(), store: sinon.stub() }
  const cache = { delete: sinon.stub(), get: sinon.stub(), set: sinon.stub() }
  const curator = {
    get: () => Promise.resolve(curation),
    apply: (_coordinates, _curationSpec, definition) => Promise.resolve(Curation.apply(definition, curation)),
    autoCurate: () => {
      return
    }
  }
  const harvestStore = { getAllLatest: () => Promise.resolve(null) }
  const harvestService = mockHarvestService()
  const summary = { summarizeAll: () => Promise.resolve(null) }
  const aggregator = { process: () => Promise.resolve(definition) }
  const upgradeHandler = { validate: def => Promise.resolve(def) }
  const service = DefinitionService(
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
  service.logger = { info: sinon.stub(), debug: sinon.stub() }
  service._harvest = sinon.stub()
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, service, harvestService }
}

function mockHarvestService() {
  return {
    harvest: () => sinon.stub(),
    done: () => Promise.resolve(),
    isTracked: () => Promise.resolve(false)
  }
}
