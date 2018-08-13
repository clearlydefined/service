// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const definitionSchema = require('../../schemas/definition')
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true })
const DefinitionService = require('../../business/definitionService')
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
    expect(service.definitionStore.delete.getCall(0).args[0].tool).to.be.eq('definition')
    expect(service.search.delete.calledOnce).to.be.true
    expect(service.search.delete.getCall(0).args[0].name).to.be.eq('test')
    expect(service.search.delete.getCall(0).args[0].tool).to.be.eq('definition')
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
    expect(service.search.delete.calledTwice).to.be.true
    expect(service.search.delete.getCall(0).args[0].name).to.be.eq('test0')
    expect(service.search.delete.getCall(1).args[0].name).to.be.eq('test1')
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

function createFile(path, attributions = [], licenses = []) {
  return { path, attributions, licenses }
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
