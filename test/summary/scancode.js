// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
const validator = require('../../schemas/validator')
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
      buildFile('bar.txt', 'GPL-3.0', ['Jane', 'Fred', 'John'])
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
    expect(summary.files[1].license).to.equal('GPL-3.0')
  })

  it('handles scan LICENSE file', () => {
    const { coordinates, harvested } = setup([buildFile('LICENSE', 'MIT', []), buildFile('LICENSE.foo', 'GPL-3.0', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('respects license score', () => {
    const { coordinates, harvested } = setup([buildFile('LICENSE', 'MIT', [], 10)])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed).to.be.undefined
  })

  it('handles scan LICENSE.md file', () => {
    const { coordinates, harvested } = setup([
      buildFile('LICENSE.md', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL-3.0', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('skips foo directory entries', () => {
    const { coordinates, harvested } = setup([buildDirectory('foo'), buildFile('foo/LICENSE.md', 'GPL-3.0', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed).to.be.undefined
    expect(summary.files[0].attributions).to.be.undefined
    expect(summary.files[0].path).to.equal('foo/LICENSE.md')
    expect(summary.files[0].license).to.equal('GPL-3.0')
  })

  it('skips license files in subdirectories', () => {
    const { coordinates, harvested } = setup([
      buildFile('foo/LICENSE.md', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL-3.0', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed).to.be.undefined
    expect(summary.files[0].attributions).to.be.undefined
    expect(summary.files[0].path).to.equal('foo/LICENSE.md')
    expect(summary.files[0].license).to.equal('MIT')
  })

  it('detects npm license file in package folder', () => {
    const { coordinates, harvested } = setup(
      [buildDirectory('package'), buildFile('package/LICENSE.md', 'GPL-3.0', [])],
      'npm/npmjs/-/test/1.0'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed.declared).to.be.equal('GPL-3.0')
    expect(summary.files[0].attributions).to.be.undefined
    expect(summary.files[0].path).to.equal('package/LICENSE.md')
    expect(summary.files[0].license).to.equal('GPL-3.0')
  })

  it('skips nuget license file in package folder', () => {
    const { coordinates, harvested } = setup(
      [buildDirectory('package'), buildFile('package/LICENSE.md', 'GPL-3.0', [])],
      'nuget/nuget/-/test/1.0'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed).to.be.undefined
    expect(summary.files[0].attributions).to.be.undefined
    expect(summary.files[0].path).to.equal('package/LICENSE.md')
    expect(summary.files[0].license).to.equal('GPL-3.0')
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
      buildFile('LICENSE.foo', 'GPL-3.0', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('creates expressions from matched_rule', () => {
    const examples = new Map([
      [
        { rule_relevance: 100, license_expression: 'mit OR apache-2.0', licenses: ['mit', 'apache-2.0'] },
        'MIT OR Apache-2.0'
      ],
      [
        { rule_relevance: 100, license_expression: 'mit AND apache-2.0', licenses: ['mit', 'apache-2.0'] },
        'MIT AND Apache-2.0'
      ],
      [{ rule_relevance: 100, license_expression: 'mit OR junk', licenses: ['mit', 'junk'] }, 'MIT OR NOASSERTION'],
      [{ rule_relevance: 100, license_expression: 'junk OR mit', licenses: ['mit', 'junk'] }, 'NOASSERTION OR MIT']
    ])

    examples.forEach((expected, input) => {
      const result = Summarizer()._createExpressionFromRule(input)
      expect(result).to.eq(expected)
    })
  })

  it('creates expressions from license expressions', () => {
    const examples = new Map([
      [new Set(['ISC']), 'ISC'],
      [new Set(['MIT', 'Apache-2.0']), 'Apache-2.0 AND MIT'],
      [new Set(['MIT OR Apache-2.0', 'GPL']), 'GPL AND MIT OR Apache-2.0'],
      [new Set(null), null],
      [new Set(), null],
      [null, null]
    ])

    examples.forEach((expected, input) => {
      const result = Summarizer()._joinExpressions(input)
      expect(result).to.eq(expected)
    })
  })

  it('uses licenseKey when no expression is available from matched_rule', () => {
    const result = Summarizer()._createExpressionFromRule({}, 'MIT')
    expect(result).to.eq('MIT')
  })

  it('handles multiple licenses in files', () => {
    const { coordinates, harvested } = setup([
      buildFile('file1', ['Apache-2.0', 'MIT'], []),
      buildFile('file2', 'MIT', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.files[0].license).to.eq('Apache-2.0 AND MIT')
    expect(summary.files[1].license).to.eq('MIT')
  })

  it('ANDs together invalid licenses', () => {
    const { coordinates, harvested } = setup([
      buildFile('file1', ['NOASSERTION', 'MIT'], []),
      buildFile('file2', 'MIT', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.files[0].license).to.eq('MIT AND NOASSERTION')
    expect(summary.files[1].license).to.eq('MIT')
  })
})

function validate(definition) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  if (!definition.coordinates)
    definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  if (!validator.validate('definition', definition)) throw new Error(validator.errorsText())
}

function setup(files, coordinateSpec) {
  const harvested = {
    _metadata: {},
    content: { scancode_version: '2.2.1', files }
  }
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, harvested }
}

function buildFile(path, license, holders, score = 100) {
  const wrapHolders = holders ? { statements: holders.map(holder => `Copyright ${holder}`) } : null
  if (!Array.isArray(license)) license = [license]
  return {
    path,
    type: 'file',
    licenses: license.map(spdx_license_key => {
      return { spdx_license_key, score }
    }),
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
