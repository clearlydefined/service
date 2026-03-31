import assert from 'node:assert/strict'
import { assertDeepEqualInAnyOrder } from '../helpers/assert.js'
import { describe, it } from 'node:test'
// @ts-nocheck
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import validator from '../../schemas/validator.js'

const { expect } = chai

import EntityCoordinates from '../../lib/entityCoordinates.js'
import { joinExpressions } from '../../lib/utils.js'
import ScanCodeLegacySummarizer from '../../providers/summary/scancode/legacy-summarizer.js'
import Summarizer from '../../providers/summary/scancode.js'

describe('ScanCode summarizer', () => {
  it('has the no coordinates info', () => {
    const { coordinates, harvested } = setup([])
    const summary = Summarizer().summarize(coordinates, harvested)
    assert.strictEqual(summary.coordinates, undefined)
  })

  it('gets all the per file license info and attribution parties', () => {
    const { coordinates, harvested } = setup([
      buildFile('foo.txt', 'MIT', ['Bob', 'Fred', 'Bob', 'bob']),
      buildFile('bar.txt', 'GPL-3.0', ['Jane', 'Fred', 'John'])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.files[0].attributions.length, 3)
    assert.strictEqual(summary.files[0].path, 'foo.txt')
    assertDeepEqualInAnyOrder(summary.files[0].attributions, ['Copyright Bob', 'Copyright Fred', 'Copyright bob'])
    assert.strictEqual(summary.files[0].license, 'MIT')
    assert.strictEqual(summary.files[1].path, 'bar.txt')
    assert.strictEqual(summary.files[1].attributions.length, 3)
    assertDeepEqualInAnyOrder(summary.files[1].attributions, [
      'Copyright John',
      'Copyright Jane',
      'Copyright Fred'
    ])
    assert.strictEqual(summary.files[1].license, 'GPL-3.0')
  })

  it('uses discovered full text license as declared license', () => {
    const { coordinates, harvested } = setup([
      buildFile('LICENSE', 'MIT', [], undefined, {}, { is_license_text: true }),
      buildFile('LICENSE.foo', 'GPL-3.0', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.licensed.declared, 'MIT')
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.files[0].natures[0], 'license')
  })

  it('respects low license score', () => {
    const { coordinates, harvested } = setup([buildFile('LICENSE', 'MIT', [], 10, { is_license_text: true })])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 1)
    assert.strictEqual(summary.licensed, undefined)
  })

  it('finds multiple license text files', () => {
    const { coordinates, harvested } = setup([
      buildFile('LICENSE1.md', 'MIT', [], undefined, {}, { is_license_text: true }),
      buildFile('LICENSE2.bar', 'GPL-3.0', [], undefined, {}, { is_license_text: true })
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.licensed.declared, 'GPL-3.0 AND MIT')
  })

  it('skips license files in subdirectories', () => {
    const { coordinates, harvested } = setup([
      buildFile('foo/LICENSE.md', 'MIT', [], undefined, { is_license_text: true }),
      buildFile('LICENSE.foo', 'GPL-3.0', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.licensed, undefined)
    assert.strictEqual(summary.files[0].attributions, undefined)
    assert.strictEqual(summary.files[0].path, 'foo/LICENSE.md')
    assert.strictEqual(summary.files[0].license, 'MIT')
  })

  it('DETECTS npm license file in package folder', () => {
    const { coordinates, harvested } = setup(
      [buildDirectory('package'), buildFile('package/LICENSE.md', 'GPL-3.0', [], 100, {}, { is_license_text: true })],
      'npm/npmjs/-/test/1.0'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.licensed.declared, 'GPL-3.0')
    assert.strictEqual(summary.files.length, 1)
    assert.strictEqual(summary.files[0].attributions, undefined)
    assert.strictEqual(summary.files[0].path, 'package/LICENSE.md')
    assert.strictEqual(summary.files[0].license, 'GPL-3.0')
  })

  it('SKIPS nuget license file in a nested `package` folder', () => {
    const { coordinates, harvested } = setup(
      [buildDirectory('package'), buildFile('package/LICENSE.md', 'GPL-3.0', [], 100, { is_license_text: true })],
      'nuget/nuget/-/test/1.0'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 1)
    assert.strictEqual(summary.licensed, undefined)
    assert.strictEqual(summary.files[0].attributions, undefined)
    assert.strictEqual(summary.files[0].path, 'package/LICENSE.md')
    assert.strictEqual(summary.files[0].license, 'GPL-3.0')
  })

  it('DETECTS asserted license file in the NPM package subdirectory', () => {
    const { coordinates, harvested } = setup(
      [buildPackageFile('package/package.json', 'MIT', [])],
      'npm/npmjs/-/test/1.0',
      '2.2.1'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 1)
    assert.strictEqual(summary.licensed.declared, 'MIT')
  })

  it('SKIPS asserted license file NOT in the NPM package subdirectory', () => {
    const { coordinates, harvested } = setup([buildPackageFile('package.json', 'MIT', [])], 'npm/npmjs/-/test/1.0')
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 1)
    assert.strictEqual(summary.licensed, undefined)
  })

  it('DETECTS asserted license file in root', () => {
    const { coordinates, harvested } = setup(
      [buildPackageFile('foo.nuspec', 'MIT', [])],
      'npm/npmjs/-/test/1.0',
      '2.2.1'
    )
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 1)
    assert.strictEqual(summary.licensed.declared, 'MIT')
  })

  it('SKIPS asserted license file NOT in the root', () => {
    const { coordinates, harvested } = setup([buildPackageFile('bar/foo.nuspec', 'MIT', [])])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 1)
    assert.strictEqual(summary.licensed, undefined)
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
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.licensed.declared, 'MIT')
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
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.licensed.declared, 'GPL-3.0')
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
      const result = joinExpressions(input)
      assert.strictEqual(result, expected)
    })
  })

  it('handles multiple licenses in files', () => {
    const { coordinates, harvested } = setup([
      buildFile('file1', ['Apache-2.0', 'MIT'], []),
      buildFile('file2', 'MIT', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.files[0].license, 'Apache-2.0 AND MIT')
    assert.strictEqual(summary.files[1].license, 'MIT')
  })

  it('ANDs together invalid licenses', () => {
    const { coordinates, harvested } = setup([
      buildFile('file1', ['NOASSERTION', 'MIT'], []),
      buildFile('file2', 'MIT', [])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    assert.strictEqual(summary.files.length, 2)
    assert.strictEqual(summary.files[0].license, 'MIT AND NOASSERTION')
    assert.strictEqual(summary.files[1].license, 'MIT')
  })
})

describe('ScanCodeLegacySummarizer', () => {
  context('_createExpressionFromLicense', () => {
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
        const result = ScanCodeLegacySummarizer()._createExpressionFromLicense(input)
        assert.strictEqual(result, expected)
      })
    })

    it('uses spdx license key when no expression is available from matched_rule', () => {
      const result = ScanCodeLegacySummarizer()._createExpressionFromLicense({ spdx_license_key: 'MIT' })
      assert.strictEqual(result, 'MIT')
    })
  })

  context('_getRootFiles', () => {
    it('gets root files', () => {
      const result = ScanCodeLegacySummarizer()._getRootFiles({ type: 'npm' }, [
        { path: 'realroot' },
        { path: 'package/packageRoot' },
        { path: 'other/nonroot' },
        { path: 'package/deep/path' }
      ])
      expect(result.map(x => x.path)).to.deep.eq(['realroot', 'package/packageRoot'])
    })
  })
})

function validate(definition) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  if (!definition.coordinates) {
    definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  }
  if (!validator.validate('definition', definition)) {
    throw new Error(validator.errorsText())
  }
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
  if (!Array.isArray(license)) {
    license = [license]
  }
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
