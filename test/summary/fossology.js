// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
const definitionSchema = require('../../schemas/definition')
const Ajv = require('ajv')

const ajv = new Ajv({ allErrors: true })
chai.use(deepEqualInAnyOrder)
const { expect } = chai
const Summarizer = require('../../providers/summary/fossology')
const EntityCoordinates = require('../../lib/entityCoordinates')

describe('Fossology summarizer', () => {
  it('has the no coordinates info', () => {
    const { coordinates, harvested } = setup([])
    const summary = Summarizer().summarize(coordinates, harvested)
    expect(summary.coordinates).to.be.undefined
  })

  it('gets all the per file license info and attribution parties', () => {
    const { coordinates, harvested } = setup([
      buildFile('foo.txt', 'MIT', ['Bob', 'Fred', 'Bob', 'bob']),
      buildFile('bar.txt', 'GPL', ['Jane', 'Fred', 'John'])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.files[0].path).to.equal('foo.txt')
    expect(summary.files[0].license).to.equal('MIT')
    expect(summary.files[1].path).to.equal('bar.txt')
    expect(summary.files[1].license).to.equal('GPL')
  })
})

function validate(definition) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  if (!definition.coordinates)
    definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  if (!ajv.validate(definitionSchema, definition)) throw new Error(ajv.errorsText())
}

function setup(files, coordinateSpec) {
  const harvested = {
    _metadata: {},
    nomos: {
      version: '3.3.0',
      output: {
        contentType: 'application/base64',
        content: new Buffer(files.map(file => file.licenses).join('\n')).toString('base64')
      }
    }
  }
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, harvested }
}

function buildFile(path, license) {
  return {
    path,
    licenses: license ? `File ${path} contains license(s) ${license}` : null
  }
}
