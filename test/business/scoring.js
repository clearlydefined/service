// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const DefinitionService = require('../../business/definitionService')
const { setIfValue } = require('../../lib/utils')
const { set } = require('lodash')

describe('Definition Service Scoring', () => {
  it('computes simple score', () => {
    const definition = createDefinition('MIT')
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(60)
  })

  it('computes full score', async () => {
    const files = [
      buildFile('bar.txt', 'MIT', ['Jane', 'Fred'], null, ['core']),
      buildFile('LICENSE.md', 'MIT', ['Jane', 'Fred'], 42, ['core'])
    ]
    const definition = createDefinition(undefined, files)
    set(definition, 'licensed.declared', 'MIT')
    set(definition, 'described.releaseDate', '2018-08-09')
    set(definition, 'described.sourceLocation', {
      type: 'git',
      provider: 'github',
      namespace: 'testns',
      name: 'testname',
      revision: '324325',
      url: 'http://foo'
    })
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(100)
    expect(scores.describedScore.total).to.be.equal(100)
  })

  it('computes zero score', async () => {
    const files = [buildFile('bar.txt', 'MIT')]
    const definition = createDefinition(undefined, files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(0)
  })
})

function createService() {
  return DefinitionService()
}

function createDefinition(declared, files) {
  const result = {}
  setIfValue(result, 'licensed.declared', declared)
  setIfValue(result, 'files', files)
  return result
}

function buildFile(path, license, holders, token, facets) {
  const result = { path }
  setIfValue(result, 'license', license)
  setIfValue(result, 'facets', facets)
  setIfValue(result, 'token', token)
  setIfValue(result, 'attributions', holders ? holders.map(entry => `Copyright ${entry}`) : null)
  return result
}
