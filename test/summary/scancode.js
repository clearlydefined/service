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
      buildFile('foo.txt', 'MIT', ['Bob', 'Fred']),
      buildFile('bar.txt', 'MIT', ['Jane', 'Fred', 'John'])
    ])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.files[0].attributions.length).to.eq(2)
    expect(summary.files[0].attributions).to.deep.equalInAnyOrder(['Copyright Bob', 'Copyright Fred'])
    expect(summary.files[1].attributions.length).to.eq(3)
    expect(summary.files[1].attributions).to.deep.equalInAnyOrder([
      'Copyright John',
      'Copyright Jane',
      'Copyright Fred'
    ])
  })

  it('handles scan LICENSE file', () => {
    const harvested = buildOutput([buildFile('LICENSE', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('handles scan LICENSE.md file', () => {
    const harvested = buildOutput([buildFile('LICENSE.md', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('skips license files in subdirectories', () => {
    const harvested = buildOutput([buildFile('/foo/LICENSE.md', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed).to.be.undefined
  })

  it('handles scan with asserted license file even in a subdirectory', () => {
    const harvested = buildOutput([buildPackageFile('package/package.json', 'MIT', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(1)
    expect(summary.licensed.declared).to.eq('MIT')
  })

  it('handles scan with both asserted discovered license file', () => {
    const harvested = buildOutput([buildPackageFile('package.json', 'MIT', []), buildFile('LICENSE.foo', 'GPL', [])])
    const summarizer = Summarizer()
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files.length).to.eq(2)
    expect(summary.licensed.declared).to.eq('MIT')
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
  const wrapHolders = holders => {
    return {
      statements: holders.map(holderList => `Copyright ${holderList}`)
    }
  }
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
