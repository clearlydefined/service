// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
const definitionSchema = require('../../schemas/definition')
const Ajv = require('ajv')

const ajv = new Ajv()
chai.use(deepEqualInAnyOrder)
const { expect } = chai
const Summarizer = require('../../providers/summary/scancode')

describe('ScanCode summarizer', () => {
  it('has the no coordinates info', () => {
    const harvested = buildOutput([])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    expect(summary.coordinates).to.be.undefined
  })

  it('gets all the attribution parties', () => {
    const harvested = buildOutput([
      buildFile('foo.txt', 'MIT', [['Bob', 'Fred']]),
      buildFile('bar.txt', 'MIT', [['Jane', 'Fred']])
    ])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.attribution.parties.length).to.eq(3)
    expect(core.attribution.parties).to.deep.equalInAnyOrder([
      'Copyright Bob',
      'Copyright Jane',
      'Copyright Fred'
    ])
    expect(core.attribution.unknown).to.eq(0)
  })

  it('handle special characters', () => {
    const harvested = buildOutput([
      buildFile('foo.txt', 'MIT', [[
        '&#60;Bob&gt;',
        'Bob\\n',
        'Bob\\r',
        'Bob\r',
        'Bob\n',
        'Bob\n',
        'Bob ',
        'Bob  Bobberson'
      ]])
    ])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.attribution.parties.length).to.eq(3)
    expect(core.attribution.parties).to.deep.equalInAnyOrder([
      'Copyright <Bob>',
      'Copyright Bob',
      'Copyright Bob Bobberson'
    ])
  })

  it('gets all the discovered licenses', () => {
    const harvested = buildOutput([buildFile('foo.txt', 'MIT', []), buildFile('bar.txt', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    const core = summary.licensed.facets.core
    expect(core.discovered.expressions).to.deep.equalInAnyOrder(['MIT', 'GPL'])
    expect(core.discovered.unknown).to.eq(0)
  })

  it('records unknown licenses and parties', () => {
    const harvested = buildOutput([buildFile('foo.txt', null, [['bob']]), buildFile('bar.txt', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    const core = summary.licensed.facets.core
    expect(core.attribution.parties).to.deep.eq(['Copyright bob'])
    expect(core.attribution.unknown).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['GPL'])
    expect(core.discovered.unknown).to.eq(1)
  })

  it('handles files with no data', () => {
    const harvested = buildOutput([buildFile('foo.txt', null, null), buildFile('bar.txt', null, null)])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.be.undefined
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.attribution.parties).to.be.undefined
    expect(core.attribution.unknown).to.eq(2)
    expect(core.discovered.expressions).to.be.undefined
    expect(core.discovered.unknown).to.eq(2)
  })

  it('handles scan with no files', () => {
    const harvested = buildOutput([])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(0)
    expect(summary.licensed).to.be.undefined
  })

  it('handles scan LICENSE file', () => {
    const harvested = buildOutput([buildFile('LICENSE', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.discovered.expressions).to.deep.equalInAnyOrder(['MIT', 'GPL'])
    expect(core.discovered.unknown).to.eq(0)
  })

  it('handles scan LICENSE.md file', () => {
    const harvested = buildOutput([buildFile('LICENSE.md', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.files[0].facets).to.be.undefined
    expect(summary.files[1].facets).to.be.undefined
    expect(summary.licensed.declared).to.eq('MIT')
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.discovered.expressions).to.deep.equalInAnyOrder(['MIT', 'GPL'])
    expect(core.discovered.unknown).to.eq(0)
  })

  it('skips license files in subdirectories', () => {
    const harvested = buildOutput([buildFile('/foo/LICENSE.md', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.be.undefined
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.discovered.expressions).to.deep.equalInAnyOrder(['MIT', 'GPL'])
    expect(core.discovered.unknown).to.eq(0)
  })

  it('handles scan with asserted license file even in a subdirectory', () => {
    const harvested = buildOutput([buildPackageFile('package/package.json', 'MIT', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed.declared).to.eq('MIT')
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['MIT'])
    expect(core.discovered.unknown).to.eq(0)
  })

  it('handles scan with both asserted discovered license file', () => {
    const harvested = buildOutput([buildPackageFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.discovered.expressions).to.deep.equalInAnyOrder(['GPL', 'MIT'])
    expect(core.discovered.unknown).to.eq(0)
  })

  it('summarizes with empty object facets', () => {
    const harvested = buildOutput([buildPackageFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested, {})
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(2)
    expect(core.discovered.expressions).to.deep.equalInAnyOrder(['GPL', 'MIT'])
    expect(core.discovered.unknown).to.eq(0)
  })

  it('summarizes with basic filters', () => {
    const harvested = buildOutput([buildPackageFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const facets = { tests: ['*.json'] }
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested, facets)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['GPL'])
    expect(core.discovered.unknown).to.eq(0)
    const tests = summary.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes with no core filters', () => {
    const harvested = buildOutput([buildPackageFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const facets = { tests: ['*.json'] }
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested, facets)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
    const core = summary.licensed.facets.core
    expect(core.files).to.eq(1)
    expect(core.discovered.expressions).to.deep.eq(['GPL'])
    expect(core.discovered.unknown).to.eq(0)
    const tests = summary.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes with everything grouped into non-core facet', () => {
    const harvested = buildOutput([buildPackageFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const facets = { tests: ['*.json'], dev: ['*.foo'] }
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested, facets)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
    expect(summary.licensed.facets.core).to.be.undefined
    const dev = summary.licensed.facets.dev
    expect(dev.files).to.eq(1)
    expect(dev.discovered.expressions).to.deep.eq(['GPL'])
    expect(dev.discovered.unknown).to.eq(0)
    const tests = summary.licensed.facets.tests
    expect(tests.files).to.eq(1)
    expect(tests.discovered.expressions).to.deep.eq(['MIT'])
    expect(tests.discovered.unknown).to.eq(0)
  })

  it('summarizes files in multiple facets', () => {
    const harvested = buildOutput([buildPackageFile('package.json', 'MIT', []), buildFile('LICENSE.json', 'GPL', [])])
    const facets = { tests: ['*.json'], dev: ['*.json'] }
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested, facets)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.files[0].facets).to.deep.equalInAnyOrder(['tests', 'dev'])
    expect(summary.files[1].facets).to.deep.equalInAnyOrder(['tests', 'dev'])
    expect(summary.licensed.declared).to.eq('MIT')
    expect(summary.licensed.facets.core).to.be.undefined
    const dev = summary.licensed.facets.dev
    expect(dev.files).to.eq(2)
    expect(dev.discovered.expressions).to.deep.equalInAnyOrder(['GPL', 'MIT'])
    expect(dev.discovered.unknown).to.eq(0)
    const tests = summary.licensed.facets.tests
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

function buildOutput(files) {
  return {
    _metadata: {},
    content: {
      scancode_version: '2.2.1',
      files
    }
  }
}

function buildFile(path, license, holders) {
  const wrapHolders = holders =>
    holders.map(entry => ({
      holders: entry,
      statements: entry.map(holder => `Copyright ${holder}`)
    }))
  return {
    path,
    licenses: license ? [{ spdx_license_key: license }] : null,
    copyrights: holders ? wrapHolders(holders) : null
  }
}

function buildPackageFile(path, license) {
  return {
    path,
    packages: [{ asserted_licenses: license ? [{ spdx_license_key: license }] : null }]
  }
}
