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

describe('Definition Service', () => {
  it('invalidates single coordinate', async () => {
    const store = { delete: sinon.stub() }
    const search = { delete: sinon.stub() }
    const service = DefinitionService(null, null, null, null, store, search)
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/2.3')
    await service.invalidate(coordinates)
    expect(store.delete.calledOnce).to.be.true
    expect(store.delete.getCall(0).args[0].name).to.be.eq('test')
    expect(store.delete.getCall(0).args[0].tool).to.be.eq('definition')
    expect(search.delete.calledOnce).to.be.true
    expect(search.delete.getCall(0).args[0].name).to.be.eq('test')
    expect(search.delete.getCall(0).args[0].tool).to.be.eq('definition')
  })

  it('invalidates array of coordinates', async () => {
    const store = { delete: sinon.stub() }
    const search = { delete: sinon.stub() }
    const service = DefinitionService(null, null, null, null, store, search)
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3')
    ]
    await service.invalidate(coordinates)
    expect(store.delete.calledTwice).to.be.true
    expect(store.delete.getCall(0).args[0].name).to.be.eq('test0')
    expect(store.delete.getCall(1).args[0].name).to.be.eq('test1')
    expect(search.delete.calledTwice).to.be.true
    expect(search.delete.getCall(0).args[0].name).to.be.eq('test0')
    expect(search.delete.getCall(1).args[0].name).to.be.eq('test1')
  })
})

describe('Definition Service Facet management', () => {
  it('handle special characters', () => {
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
    const definition = createDefinition(undefined, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
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

  it('handles files with no data', () => {
    const files = [buildFile('foo.txt', null, null), buildFile('bar.txt', null, null)]
    const definition = createDefinition(undefined, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
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

  it('handles no files', () => {
    const files = []
    const definition = createDefinition(undefined, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
    validate(definition)
    expect(definition.files.length).to.eq(0)
    expect(definition.licensed).to.be.undefined
  })

  it('gets all the attribution parties', () => {
    const files = [buildFile('foo.txt', 'MIT', ['Bob', 'Fred']), buildFile('bar.txt', 'MIT', ['Jane', 'Fred'])]
    const definition = createDefinition(undefined, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
    validate(definition)
    const core = definition.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.attribution.parties.length).to.eq(3)
    expect(core.attribution.parties).to.deep.equalInAnyOrder(['Copyright Bob', 'Copyright Jane', 'Copyright Fred'])
    expect(core.attribution.unknown).to.eq(0)
  })

  it('handle special characters', () => {
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
    const definition = createDefinition(undefined, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
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

  it('summarizes with basic facets', () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])]
    const facets = { tests: ['*.json'] }
    const definition = createDefinition(facets, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
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

  it('summarizes with no core filters', () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])]
    const facets = { tests: ['*.json'] }
    const definition = createDefinition(facets, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
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

  it('summarizes with everything grouped into non-core facet', () => {
    const files = [buildFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])]
    const facets = { tests: ['*.json'], dev: ['*.foo'] }
    const definition = createDefinition(facets, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
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

  it('summarizes files in multiple facets', () => {
    const files = [buildFile('LICENSE.json', 'GPL', []), buildFile('Test.json', 'MIT', [])]
    const facets = { tests: ['*.json'], dev: ['*.json'] }
    const definition = createDefinition(facets, files)
    const service = DefinitionService()
    service._ensureFacets(definition)
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

  it('handles no facet defs', async () => {
    const files = [createFile('/foo.txt', ['bob', 'jane'], ['MIT']), createFile('/bar.js', ['jane'], ['GPL-v3'])]
    const definition = createDefinition([], files)
    const service = DefinitionService(null, null, null, null, null, null)
    service._ensureFacets(definition)
  })
})

function validate(definition) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  if (!ajv.validate(definitionSchema, definition)) throw new Error(ajv.errorsText())
}

function createDefinition(facets, files) {
  return { described: { facets }, files }
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
