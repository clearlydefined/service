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

  it('uses discovered full text license as declared license', () => {
    const { coordinates, harvested } = setup([
      buildFile('LICENSE', 'MIT', [], undefined, {}, { is_license_text: true }),
      buildFile('LICENSE.foo', 'GPL-3.0', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.licensed.declared).to.eq('MIT')
    expect(summary.files.length).to.eq(2)
    expect(summary.files[0].natures[0]).to.be.equal('license')
  })

  it('respects low license score', () => {
    const { coordinates, harvested } = setup([buildFile('LICENSE', 'MIT', [], 10, { is_license_text: true })])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed).to.be.undefined
  })

  it('finds multiple license text files', () => {
    const { coordinates, harvested } = setup([
      buildFile('LICENSE1.md', 'MIT', [], undefined, {}, { is_license_text: true }),
      buildFile('LICENSE2.bar', 'GPL-3.0', [], undefined, {}, { is_license_text: true })
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('GPL-3.0 AND MIT')
  })

  it('skips license files in subdirectories', () => {
    const { coordinates, harvested } = setup([
      buildFile('foo/LICENSE.md', 'MIT', [], undefined, { is_license_text: true }),
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

  it('DETECTS npm license file in package folder', () => {
    const { coordinates, harvested } = setup(
      [buildDirectory('package'), buildFile('package/LICENSE.md', 'GPL-3.0', [], 100, {}, { is_license_text: true })],
      'npm/npmjs/-/test/1.0'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.licensed.declared).to.be.equal('GPL-3.0')
    expect(summary.files.length).to.eq(1)
    expect(summary.files[0].attributions).to.be.undefined
    expect(summary.files[0].path).to.equal('package/LICENSE.md')
    expect(summary.files[0].license).to.equal('GPL-3.0')
  })

  it('SKIPS nuget license file in a nested `package` folder', () => {
    const { coordinates, harvested } = setup(
      [buildDirectory('package'), buildFile('package/LICENSE.md', 'GPL-3.0', [], 100, { is_license_text: true })],
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

  it('DETECTS asserted license file in the NPM package subdirectory', () => {
    const { coordinates, harvested } = setup(
      [buildPackageFile('package/package.json', 'MIT', [])],
      'npm/npmjs/-/test/1.0',
      '2.2.1'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('SKIPS asserted license file NOT in the NPM package subdirectory', () => {
    const { coordinates, harvested } = setup([buildPackageFile('package.json', 'MIT', [])], 'npm/npmjs/-/test/1.0')
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed).to.be.undefined
  })

  it('DETECTS asserted license file in root', () => {
    const { coordinates, harvested } = setup(
      [buildPackageFile('foo.nuspec', 'MIT', [])],
      'npm/npmjs/-/test/1.0',
      '2.2.1'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('SKIPS asserted license file NOT in the root', () => {
    const { coordinates, harvested } = setup([buildPackageFile('bar/foo.nuspec', 'MIT', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed).to.be.undefined
  })

  it('prioritizes package manifest over full text license file for 2.2', () => {
    const { coordinates, harvested } = setup(
      [
        buildFile('package/LICENSE.foo', 'GPL-3.0', [], 100, {}, { is_license_text: true }),
        buildPackageFile('package/package.json', 'MIT', [])
      ],
      'npm/npmjs/-/test/1.0',
      '2.2.1'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('prioritizes full text license file over package manifest for 3.0', () => {
    const { coordinates, harvested } = setup(
      [
        buildFile('package/LICENSE.foo', 'GPL-3.0', [], 100, {}, { is_license_text: true }),
        buildPackageFile('package/package.json', 'MIT', [])
      ],
      'npm/npmjs/-/test/1.0',
      '3.0.2'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('GPL-3.0')
  })

  it('creates expressions from matched_rule', () => {
    const examples = new Map([
      [buildRule('mit OR apache-2.0', ['mit', 'apache-2.0']), 'MIT OR Apache-2.0'],
      [buildRule('mit AND apache-2.0', ['mit', 'apache-2.0']), 'MIT AND Apache-2.0'],
      [buildRule('mit OR junk', ['mit', 'junk']), 'MIT OR NOASSERTION'],
      [buildRule('junk OR mit', ['mit', 'junk']), 'NOASSERTION OR MIT'],
      [
        buildRule('mit AND apache-2.0 AND agpl-generic-additional-terms', [
          'mit',
          'apache-2.0',
          'agpl-generic-additional-terms'
        ]),
        'MIT AND Apache-2.0 AND NOASSERTION'
      ]
    ])
    examples.forEach((expected, input) => {
      const result = Summarizer()._createExpressionFromLicense(input)
      expect(result).to.eq(expected)
    })
  })

  it('creates expressions from license expressions', () => {
    const examples = new Map([
      [new Set(['ISC']), 'ISC'],
      [new Set(['MIT', 'Apache-2.0']), 'Apache-2.0 AND MIT'],
      [new Set(['MIT OR Apache-2.0', 'GPL-3.0']), 'GPL-3.0 AND (MIT OR Apache-2.0)'],
      [new Set(null), null],
      [new Set(), null],
      [null, null]
    ])
    examples.forEach((expected, input) => {
      const result = Summarizer()._joinExpressions(input)
      expect(result).to.eq(expected)
    })
  })

  it('uses spdx license key when no expression is available from matched_rule', () => {
    const result = Summarizer()._createExpressionFromLicense({ spdx_license_key: 'MIT' })
    expect(result).to.eq('MIT')
  })

  it('gets root files', () => {
    const result = Summarizer()._getRootFiles({ type: 'npm' }, [
      { path: 'realroot' },
      { path: 'package/packageRoot' },
      { path: 'other/nonroot' },
      { path: 'package/deep/path' }
    ])
    expect(result.map(x => x.path)).to.deep.eq(['realroot', 'package/packageRoot'])
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

function setup(files, coordinateSpec, scancode_version = '30.1.0') {
  const harvested = {
    _metadata: {},
    content: { scancode_version, files }
  }
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'nuget/nuget/-/test/1.0')
  return { coordinates, harvested }
}

function buildFile(path, license, holders, score = 100, rule = {}, fileProps = {}) {
  const wrapHolders = holders ? { statements: holders.map(holder => `Copyright ${holder}`) } : null
  if (!Array.isArray(license)) license = [license]
  return {
    path,
    type: 'file',
    licenses: license.map(spdx_license_key => {
      return { spdx_license_key, score, matched_rule: rule }
    }),
    copyrights: [wrapHolders],
    ...fileProps
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

function buildRule(expression, licenses) {
  return { matched_rule: { rule_relevance: 100, license_expression: expression, licenses } }
}
