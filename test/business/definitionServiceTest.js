// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const definitionSchema = require('../../schemas/definition')
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true })
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
  })

  it('invalidates array of coordinates', async () => {
    const { service } = setup()
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3')
    ]
    await service.invalidate(coordinates)
    expect(service.definitionStore.delete.calledTwice).to.be.true
    expect(service.definitionStore.delete.getCall(0).args[0].name).to.be.eq('test0')
    expect(service.definitionStore.delete.getCall(1).args[0].name).to.be.eq('test1')
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
    expect(service.search.store.calledOnce).to.be.true
  })
})

describe('Definition Service score computation', () => {
  it('computes full score', async () => {
    const files = [buildFile('bar.txt', 'MIT', ['Jane', 'Fred'])]
    const raw = createDefinition(undefined, files)
    set(raw, 'licensed.declared', 'MIT')
    set(raw, 'described.releaseDate', '2018-08-09')
    set(raw, 'described.sourceLocation', {
      type: 'git',
      provider: 'github',
      namespace: 'testns',
      name: 'testname',
      revision: '324325',
      url: 'http://foo'
    })
    const { service, coordinates } = setup(raw)
    const definition = await service.compute(coordinates)
    expect(definition.described.score).to.eq(2)
    expect(definition.described.toolScore).to.eq(2)
    expect(definition.licensed.score).to.eq(2)
    expect(definition.licensed.toolScore).to.eq(2)
  })

  it('computes zero score', async () => {
    const files = [buildFile('bar.txt', 'MIT')]
    const raw = createDefinition(undefined, files)
    const { service, coordinates } = setup(raw)
    const definition = await service.compute(coordinates)
    expect(definition.described.score).to.eq(0)
    expect(definition.described.toolScore).to.eq(0)
    expect(definition.licensed.score).to.eq(0)
    expect(definition.licensed.toolScore).to.eq(0)
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
    expect(definition.described.score).to.eq(1)
    expect(definition.described.toolScore).to.eq(0)
    expect(definition.licensed.score).to.eq(2)
    expect(definition.licensed.toolScore).to.eq(0)
  })
})

describe('Definition Service Facet management', () => {
  it('handle special characters', async () => {
    const files = [
      buildFile('foo.txt', 'MIT', [
        '&#60;Bob&gt;',
        'Bob\\n',
        'Bob\\r',
        'Bob\r',
        'Bob\n',
        'Bob\n',
        'Bob ',
        'Bob  Bobberson'
      ])
    ]
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.attribution.parties.length).to.eq(3)
    expect(core.attribution.parties).to.deep.equalInAnyOrder([
      'Copyright <Bob>',
      'Copyright Bob',
      'Copyright Bob Bobberson'
    ])
    expect(definition.files.length).to.eq(1)
    expect(definition.files[0].attributions).to.deep.equalInAnyOrder([
      'Copyright <Bob>',
      'Copyright Bob',
      'Copyright Bob Bobberson'
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
    expect(definition.licensed.score).to.eq(0)
    expect(definition.licensed.toolScore).to.eq(0)
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

  it('handle special characters', async () => {
    const files = [
      buildFile('foo.txt', 'MIT', [
        '&#60;Bob&gt;',
        'Bob\\n',
        'Bob\\r',
        'Bob\r',
        'Bob\n',
        'Bob\n',
        'Bob ',
        'Bob  Bobberson'
      ])
    ]
    const { service, coordinates } = setup(createDefinition(undefined, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.attribution.parties.length).to.eq(3)
    expect(core.attribution.parties).to.deep.equalInAnyOrder([
      'Copyright <Bob>',
      'Copyright Bob',
      'Copyright Bob Bobberson'
    ])
  })

  it('summarizes with basic facets', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])]
    const facets = { tests: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['GPL'])
    expect(core.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes with no core filters', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])]
    const facets = { tests: ['*.json'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['GPL'])
    expect(core.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes with everything grouped into non-core facet', async () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])]
    const facets = { tests: ['*.json'], dev: ['*.foo'] }
    const { service, coordinates } = setup(createDefinition(facets, files))
    const definition = await service.compute(coordinates)
    validate(definition)
    expect(definition.files.length).to.eq(2)
    expect(definition.licensed.facets.core).to.be.undefined
    const dev = definition.licensed.facets.dev
    expect(dev.files).to.eq(1)
    expect(dev.discovered.expressions).to.deep.eq(['GPL'])
    expect(dev.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes files in multiple facets', async () => {
    const files = [buildFile('LICENSE.json', 'GPL', []), buildFile('Test.json', 'MIT', [])]
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
    expect(dev.discovered.expressions).to.deep.equalInAnyOrder(['GPL', 'MIT'])
    expect(dev.discovered.unknown).to.eq(0)
    const tests = definition.licensed.facets.tests
    expect(tests.files).to.eq(2)
    expect(tests.discovered.expressions).to.deep.equalInAnyOrder(['MIT', 'GPL'])
    expect(tests.discovered.unknown).to.eq(0)
  })
})

describe('Aggregation service', () => {
  it('handles no tool data', async () => {
    const { service, coordinates } = setupAggregator()
    const aggregated = service.process({})
    expect(aggregated).to.be.null
  })

  it('handles one tool one version data', async () => {
    const summaries = { tool2: { '1.0.0': { files: [buildFile('foo.txt', 'MIT')] } } }
    const { service, coordinates } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
  })

  it('handles one tool multiple version data', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT'), buildFile('bar.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL')] }
      }
    }
    const { service, coordinates } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].path).to.eq('foo.txt')
    expect(aggregated.files[0].license).to.eq('GPL')
  })

  it('handles multiple tools and one file data', async () => {
    const summaries = {
      tool2: { '1.0.0': { files: [buildFile('foo.txt', 'MIT')] }, '2.0.0': { files: [buildFile('foo.txt', 'GPL')] } },
      tool1: { '3.0.0': { files: [buildFile('foo.txt', 'BSD')] } }
    }
    const { service, coordinates } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].license).to.eq('BSD')
  })

  it('handles multiple tools and multiple file data with extras ignored', async () => {
    const summaries = {
      tool2: { '1.0.0': { files: [buildFile('foo.txt', 'MIT')] }, '2.0.0': { files: [buildFile('foo.txt', 'GPL')] } },
      tool1: { '3.0.0': { files: [buildFile('foo.txt', 'BSD')] }, '2.0.0': { files: [buildFile('bar.txt', 'GPL')] } }
    }
    const { service, coordinates } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].license).to.eq('BSD')
  })

  it('handles multiple tools and multiple file data with extras included', async () => {
    const summaries = {
      tool2: { '1.0.0': { files: [buildFile('foo.txt', 'MIT')] }, '2.0.0': { files: [buildFile('foo.txt', 'GPL')] } },
      tool1: {
        '3.0.0': { files: [buildFile('foo.txt', 'BSD'), buildFile('bar.txt', 'GPL')] },
        '2.0.0': { files: [buildFile('bar.txt', 'GPL')] }
      }
    }
    const { service, coordinates } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(2)
    expect(aggregated.files[0].path).to.eq('foo.txt')
    expect(aggregated.files[0].license).to.eq('BSD')
    expect(aggregated.files[1].path).to.eq('bar.txt')
    expect(aggregated.files[1].license).to.eq('GPL')
  })
})

function validate(definition) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  if (!ajv.validate(definitionSchema, definition)) throw new Error(ajv.errorsText())
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
  const curator = {
    get: () => Promise.resolve(curation),
    apply: (coordinates, curationSpec, definition) => Promise.resolve(Curation.apply(definition, curation))
  }
  const harvest = { getAll: () => Promise.resolve(null) }
  const summary = { summarizeAll: () => Promise.resolve(null) }
  const aggregator = { process: () => Promise.resolve(definition) }
  const service = DefinitionService(harvest, summary, aggregator, curator, store, search)
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, service }
}

function setupAggregator() {
  const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0')
  const config = { precedence: [['tool1', 'tool2', 'tool3']] }
  const service = AggregatorService(config)
  return { service, coordinates }
}
