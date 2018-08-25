// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
const definitionSchema = require('../../schemas/definition')
const Ajv = require('ajv')

const ajv = new Ajv({ allErrors: true })
chai.use(deepEqualInAnyOrder)
const { expect } = chai
const Summarizer = require('../../providers/summary/scancode')
const EntityCoordinates = require('../../lib/entityCoordinates')

describe('ScanCode summarizer', () => {
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
    expect(summary.files[0].attributions.length).to.eq(3)
    expect(summary.files[0].path).to.equal('foo.txt')
    expect(summary.files[0].attributions).to.deep.equalInAnyOrder(['Copyright Bob', 'Copyright Fred', 'Copyright bob'])
    expect(summary.files[0].license).to.equal('MIT')
    expect(summary.files[1].path).to.equal('bar.txt')
    expect(summary.files[1].attributions.length).to.eq(3)
    expect(summary.files[1].attributions).to.deep.equalInAnyOrder([
      'Copyright John',
      'Copyright Jane',
      'Copyright Fred'
    ])
    expect(summary.files[1].license).to.equal('GPL')
  })

  it('handles scan LICENSE file', () => {
    const { coordinates, harvested } = setup([buildFile('LICENSE', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('handles scan LICENSE.md file', () => {
    const { coordinates, harvested } = setup([buildFile('LICENSE.md', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('skips directory entries', () => {
    const { coordinates, harvested } = setup([buildDirectory('foo'), buildFile('foo/LICENSE.md', 'GPL', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed).to.be.undefined
    expect(summary.files[0].attributions).to.be.undefined
    expect(summary.files[0].path).to.equal('foo/LICENSE.md')
    expect(summary.files[0].license).to.equal('GPL')
  })

  it('skips license files in subdirectories', () => {
    const { coordinates, harvested } = setup([
      buildFile('foo/LICENSE.md', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed).to.be.undefined
    expect(summary.files[0].attributions).to.be.undefined
    expect(summary.files[0].path).to.equal('foo/LICENSE.md')
    expect(summary.files[0].license).to.equal('MIT')
  })

  it('handles scan with asserted license file even in a subdirectory', () => {
    const { coordinates, harvested } = setup([buildPackageFile('package/package.json', 'MIT', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('handles scan with both asserted discovered license file', () => {
    const { coordinates, harvested } = setup([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
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
    content: { scancode_version: '2.2.1', files }
  }
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, harvested }
}

function buildFile(path, license, holders) {
  const wrapHolders = holders ? { statements: holders.map(holder => `Copyright ${holder}`) } : null
  return {
    path,
    type: 'file',
    licenses: license ? [{ spdx_license_key: license }] : null,
    copyrights: [wrapHolders]
  }
}

function buildPackageFile(path, license) {
  return {
    path,
    type: 'file',
    packages: [{ asserted_licenses: license ? [{ spdx_license_key: license }] : null }]
  }
}

function buildDirectory(path) {
  return { path, type: 'directory' }
}
