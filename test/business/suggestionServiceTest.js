// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const SuggestionService = require('../../business/suggestionService')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { setIfValue } = require('../../lib/utils')
const moment = require('moment')
const { get } = require('lodash')

const testCoordinates = EntityCoordinates.fromString('npm/npmjs/-/test/10.0')

describe('Suggestion Service', () => {
  it('gets suggestion for missing declared license', async () => {
    const now = moment()
    const definition = createDefinition(testCoordinates, now, null, files)
    const before1 = createModifiedDefinition(testCoordinates, now, -3, 'MIT', files, attributions)
    const before2 = createModifiedDefinition(testCoordinates, now, -5, 'MIT', files, attributions)
    const after = createModifiedDefinition(testCoordinates, now, 2, 'GPL', files, attributions)
    const others = [before1, before2, after]
    const service = setup(definition, others)
    const suggestions = await service.get(testCoordinates)
    expect(suggestions).to.not.be.null
    expect(service.definitionService.find.getCall(0).args[0]).to.deep.eq({
      type: 'npm',
      provider: 'npmjs',
      name: 'test',
      namespace: null
    })
    const declared = get(suggestions, 'licensed.declared')
    expect(declared).to.equalInAnyOrder([
      { value: 'MIT', version: '10-3.0' },
      { value: 'MIT', version: '10-5.0' },
      { value: 'GPL', version: '102.0' }
    ])
  })

  it('sorts suggestion by releaseDate', async () => {
    const now = moment()
    const definition = createDefinition(testCoordinates, now, null, files)
    const before1 = createModifiedDefinition(testCoordinates, now, -3, 'MIT', files, attributions)
    const before2 = createModifiedDefinition(testCoordinates, now, -5, 'MIT', files, attributions)
    const after = createModifiedDefinition(testCoordinates, now, 2, 'GPL', files, attributions)
    const others = [after, before2, before1]
    const service = setup(definition, others)
    const suggestions = await service.get(testCoordinates)
    expect(suggestions).to.not.be.null
    expect(service.definitionService.find.getCall(0).args[0]).to.deep.eq({
      type: 'npm',
      provider: 'npmjs',
      name: 'test',
      namespace: null
    })
    const declared = get(suggestions, 'licensed.declared')
    expect(declared).to.deep.eq([
      { value: 'MIT', version: '10-3.0' },
      { value: 'MIT', version: '10-5.0' },
      { value: 'GPL', version: '102.0' }
    ])
  })

  it('gets no suggestions for definition with declared license', async () => {
    const now = moment()
    const definition = createDefinition(testCoordinates, now, 'MIT', files)
    const before1 = createModifiedDefinition(testCoordinates, now, -3, 'MIT', files, attributions)
    const before2 = createModifiedDefinition(testCoordinates, now, -5, 'MIT', files, attributions)
    const after = createModifiedDefinition(testCoordinates, now, 2, 'GPL', files, attributions)
    const others = [before1, before2, after]
    const service = setup(definition, others)
    const suggestions = await service.get(testCoordinates)
    expect(suggestions).to.be.null
    expect(service.definitionService.find.getCall(0).args[0]).to.deep.eq({
      type: 'npm',
      provider: 'npmjs',
      name: 'test',
      namespace: null
    })
  })

  it('returns no suggestions if there are no related definitions AND no discoveries', async () => {
    const now = moment()
    const definition = createDefinition(testCoordinates, now, null, files)
    const service = setup(definition, [])
    const suggestions = await service.get(testCoordinates)
    expect(suggestions).to.be.null
  })

  it('queries related definitions with namespace', async () => {
    const now = moment()
    const coordinates = EntityCoordinates.fromString('npm/npmjs/@scope/scope-test/1.0.0')
    const definition = createDefinition(coordinates, now, null, files)
    const service = setup(definition, [])
    await service.get(coordinates)
    expect(service.definitionService.find.getCall(0).args[0]).to.deep.eq({
      type: 'npm',
      provider: 'npmjs',
      name: 'scope-test',
      namespace: '@scope'
    })
  })

  it('will include \'discovered\' licenses for declared license suggestions', async () => {
    const t2 = EntityCoordinates.fromString('gem/rubygems/-/autobuild/1.6.2.b8')
    const sample_definition = require('./evidence/issue-453-sample-1.json')
    const service = setup(sample_definition, [])
    const suggestions = await service.get(t2)
    expect(suggestions).to.not.be.null
    const declared = get(suggestions, 'licensed.declared')
    expect(declared).to.equalInAnyOrder([
      { value: 'GPL-2.0', version: '1.6.2.b8' }
    ])
  })
})

const attributions = ['test', 'test2', 'test3']
const files = [{ path: 'test.txt' }, { path: 'test2.txt' }, { path: 'test3.txt' }]

function createModifiedDefinition(coordinates, now, amount, license, files, attributions) {
  const newCoordinates = EntityCoordinates.fromObject({
    ...coordinates,
    revision: `${coordinates.revision.split('.')[0] + amount}.0`
  })
  const newFiles = files.map(file => {
    return { ...file, license, attributions }
  })
  const newDate = moment(now).add(amount, 'days')
  return createDefinition(newCoordinates, newDate, license, newFiles)
}

function createDefinition(coordinates, releaseDate, license, files) {
  const result = { coordinates }
  setIfValue(result, 'licensed.declared', license)
  setIfValue(result, 'described.releaseDate', releaseDate.toDate())
  setIfValue(result, 'files', files)
  return result
}

function setup(definition, others) {
  const definitionService = { find: () => { } }
  sinon.stub(definitionService, 'find').resolves({ data: [...others, definition] })
  return SuggestionService(definitionService)
}
