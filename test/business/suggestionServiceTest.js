// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const SuggestionService = require('../../business/suggestionService')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { setIfValue } = require('../../lib/utils')
const moment = require('moment')
const { get } = require('lodash')

const testCoordinates = EntityCoordinates.fromString('npm/npmjs/-/test/10.0')

describe('Suggestion Service', () => {
  it('gets suggestion for missing declared license', async () => {
    const now = moment()
    const definition = createDefinition(testCoordinates, now)
    const before1 = createModifiedDefinition(testCoordinates, now, -3, 'MIT')
    const before2 = createModifiedDefinition(testCoordinates, now, -5, 'MIT')
    const after = createModifiedDefinition(testCoordinates, now, 2, 'GPL')
    const others = [before1, before2, after]
    const service = setup(definition, others)
    const suggestions = await service.get(testCoordinates)
    expect(suggestions).to.not.be.null
    const declared = get(suggestions, 'licensed.declared')
    console.log('suggestions,', suggestions)
    console.log('declared,', declared)
    expect(declared).to.equalInAnyOrder([
      { value: 'MIT', version: '10-3.0' },
      { value: 'MIT', version: '10-5.0' },
      { value: 'GPL', version: '102.0' }
    ])
  })
})

function createModifiedDefinition(coordinates, now, amount, license, files) {
  const newCoordinates = EntityCoordinates.fromObject({
    ...coordinates,
    revision: `${coordinates.revision.split('.')[0] + amount}.0`
  })
  const newDate = moment(now).add(amount, 'days')
  return createDefinition(newCoordinates, newDate, license, files)
}

function createDefinition(coordinates, releaseDate, license, files) {
  const result = { coordinates }
  setIfValue(result, 'licensed.declared', license)
  setIfValue(result, 'described.releaseDate', releaseDate.toDate())
  setIfValue(result, 'files', files)
  return result
}

function setup(definition, others) {
  const definitionService = { getAll: () => Promise.resolve([...others, definition]) }
  const definitionStore = { list: () => Promise.resolve([...others, definition]) }
  return SuggestionService(definitionService, definitionStore)
}
