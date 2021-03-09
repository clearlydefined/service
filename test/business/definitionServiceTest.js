// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const validator = require('../../schemas/validator')
const DefinitionService = require('../../business/definitionService')
const AggregatorService = require('../../business/aggregator')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { setIfValue } = require('../../lib/utils')
const Curation = require('../../lib/curation')
const { set } = require('lodash')

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
    expect(service.logger.info.calledOnce).to.be.true
    expect(service.logger.info.getCall(0).args[0]).to.eq('definition not available')
    expect(service._harvest.calledOnce).to.be.true
    expect(service._harvest.getCall(0).args[0]).to.eq(coordinates)
  })

  it('logs and harvests new definitions with undefined tools', async () => {
    const { service, coordinates } = setup(createDefinition(null, null, undefined))
    await service.get(coordinates)
    expect(service.logger.info.calledOnce).to.be.true
    expect(service.logger.info.getCall(0).args[0]).to.eq('definition not available')
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

describe('Aggregation service', () => {
  it('handles no tool data', async () => {
    const { service } = setupAggregator()
    const aggregated = service.process({})
    expect(aggregated).to.be.null
  })

  it('handles one tool one version data', async () => {
    const summaries = { tool2: { '1.0.0': { files: [buildFile('foo.txt', 'MIT')] } } }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
  })

  it('handles one tool multiple version data', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT'), buildFile('bar.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].path).to.eq('foo.txt')
    expect(aggregated.files[0].license).to.eq('GPL-2.0')
  })

  it('handles multiple tools and one file data', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      },
      tool1: { '3.0.0': { files: [buildFile('foo.txt', 'BSD-3-Clause')] } }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].license).to.equal('BSD-3-Clause AND GPL-2.0')
  })

  it('handles multiple tools and multiple file data with extras ignored', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      },
      tool1: {
        '3.0.0': { files: [buildFile('foo.txt', 'BSD-3-Clause')] },
        '2.0.0': { files: [buildFile('bar.txt', 'GPL-2.0')] }
      }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].license).to.equal('BSD-3-Clause AND GPL-2.0')
  })

  it('handles multiple tools and multiple file data with extras included', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      },
      tool1: {
        '3.0.0': { files: [buildFile('foo.txt', 'BSD-3-Clause'), buildFile('bar.txt', 'GPL-2.0')] },
        '2.0.0': { files: [buildFile('bar.txt', 'GPL-2.0')] }
      }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(2)
    expect(aggregated.files[0].path).to.eq('foo.txt')
    expect(aggregated.files[0].license).to.equal('BSD-3-Clause AND GPL-2.0')
    expect(aggregated.files[1].path).to.eq('bar.txt')
    expect(aggregated.files[1].license).to.eq('GPL-2.0')
  })
})

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
    autoCurate: () => { return }
  }
  const harvestStore = { getAll: () => Promise.resolve(null) }
  const harvestService = { harvest: () => sinon.stub() }
  const summary = { summarizeAll: () => Promise.resolve(null) }
  const aggregator = { process: () => Promise.resolve(definition) }
  const service = DefinitionService(harvestStore, harvestService, summary, aggregator, curator, store, search, cache)
  service.logger = { info: sinon.stub() }
  service._harvest = sinon.stub()
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, service }
}

function setupAggregator() {
  const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0')
  const config = { precedence: [['tool1', 'tool2', 'tool3']] }
  const service = AggregatorService(config)
  return { service, coordinates }
}
