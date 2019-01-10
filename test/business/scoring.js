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
      buildFile('LICENSE.md', 'MIT', ['Jane', 'Fred'], 42)
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

  it('computes zero score for empty definitions', async () => {
    const definition = createDefinition(undefined)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(0)
  })

  it('does not give value to file with only license', async () => {
    const files = [buildFile('bar.txt', 'MIT')]
    const definition = createDefinition(undefined, files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(0)
  })

  it('does not give value to file with only copyrights and skips non-core files', async () => {
    // on file that is incomplete, one file that is complete but in a non-core facet. Neither should be counted
    const files = [buildFile('bar.txt', null, ['bob']), buildFile('two.txt', 'MIT', ['bob'], null, ['test'])]
    const definition = createDefinition(undefined, files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(0)
  })

  it('correctly apportions score based on number of clearly defined files', async () => {
    const files = [
      buildFile('one.txt'),
      buildFile('two.txt'),
      buildFile('three.txt'),
      buildFile('four.txt', 'MIT', ['bob'])
    ]
    const definition = createDefinition(undefined, files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(6) // 25% (1 of 4 files) of 25 points
    expect(scores.licensedScore.discovered).to.be.equal(6)
  })

  it('correctly matches discovered and declared licenses', async () => {
    const files = [
      buildFile('one.txt', 'MIT OR GPL-3.0'),
      buildFile('two.txt', 'MIT AND GPL-3.0'),
      buildFile('three.txt', 'Apache-2.0')
    ]
    const definition = createDefinition('MIT OR GPL-3.0 OR (MIT AND GPL-3.0) OR Apache-2.0', files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(60)
    expect(scores.licensedScore.consistency).to.be.equal(15)
  })

  it('correctly filters NOASSERTION licenses', async () => {
    const definition = createDefinition('NOASSERTION')
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(15)
    expect(scores.licensedScore.declared).to.be.equal(0)
  })

  it('correctly finds mismatched discovered and declared licenses', async () => {
    const files = [
      buildFile('one.txt', 'MIT OR GPL-3.0'),
      buildFile('two.txt', 'MIT AND GPL-3.0'),
      buildFile('three.txt', 'Apache-2.0')
    ]
    const definition = createDefinition('MIT OR GPL-3.0 OR (MIT AND GPL-3.0)', files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(45)
    expect(scores.licensedScore.consistency).to.be.equal(0)
  })

  it('correctly matches licenses and texts', async () => {
    const files = [
      buildFile('one.txt', 'MIT OR GPL-3.0'),
      buildFile('two.txt', 'MIT AND GPL-3.0'),
      buildFile('LICENSE.MIT', 'MIT', null, 42),
      buildFile('LICENSE.GPL', 'GPL-3.0', null, 42),
      buildFile('LICENSE.APACHE', 'Apache-2.0', null, 42)
    ]
    const definition = createDefinition('Apache-2.0', files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(60)
    expect(scores.licensedScore.texts).to.be.equal(15)
  })

  it('correctly finds mismatched licenses and texts', async () => {
    const files = [
      buildFile('one.txt', 'MIT OR GPL-3.0'),
      buildFile('two.txt', 'MIT AND GPL-3.0'),
      buildFile('LICENSE.MIT', 'MIT', null, 42)
    ]
    const definition = createDefinition(null, files)
    const service = createService()
    const scores = service._computeScores(definition)
    expect(scores.licensedScore.total).to.be.equal(0)
    expect(scores.licensedScore.texts).to.be.equal(0)
  })
})

function createService() {
  return DefinitionService()
}

function createDefinition(declared, files) {
  const result = {}
  setIfValue(result, 'licensed.declared', declared)
  setIfValue(result, 'files', files)
  if (files) {
    // collect up the flie license expressions
    const expressions = Array.from(
      files.reduce((list, file) => {
        if (!file.facets || file.facets.includes('core')) list.add(file.license)
        return list
      }, new Set())
    ).filter(e => e)
    set(result, 'licensed.facets.core.discovered.expressions', expressions)
  }
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
