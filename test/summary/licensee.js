// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../providers/summary/licensee')()

describe('LicenseeSummarizer', () => {
  it('should skip non-exact and low confidence and missing paths matches', () => {
    const data = setup([
      { path: 'LICENSE', license: 'MIT' },
      { path: 'foo.txt', license: 'MIT', matcher: 'foo' },
      { path: 'foo.txt', license: 'NOASSERTION', matcher: 'foo' },
      { path: 'bar.txt', license: 'MIT', confidence: '60' },
      { license: 'MIT', confidence: '100' }
    ])
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [{ path: 'LICENSE', license: 'MIT', natures: ['license'] }],
      licensed: { declared: 'MIT' }
    })
  })

  it('should include attachment tokens where available', () => {
    const data = setup([{ path: 'LICENSE', license: 'MIT' }], [{ path: 'LICENSE', token: 'thisistoken' }])
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [{ path: 'LICENSE', license: 'MIT', natures: ['license'], token: 'thisistoken' }],
      licensed: { declared: 'MIT' }
    })
  })

  it('should AND together matched declared licenses', () => {
    const data = setup([
      { path: 'LICENSE-MIT', license: 'MIT' },
      { path: 'LICENSE-APACHE', license: 'Apache-2.0' }
    ])
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [
        { path: 'LICENSE-MIT', license: 'MIT', natures: ['license'] },
        { path: 'LICENSE-APACHE', license: 'Apache-2.0', natures: ['license'] }
      ],
      licensed: { declared: 'MIT AND Apache-2.0' }
    })
  })

  it('should filter NOASSERTION for matched declared licenses', () => {
    const data = setup([
      { path: 'LICENSE-MIT', license: 'MIT' },
      { path: 'LICENSE', license: 'NOASSERTION' }
    ])
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [{ path: 'LICENSE-MIT', license: 'MIT', natures: ['license'] }],
      licensed: { declared: 'MIT' }
    })
  })

  it('should handle no files found', () => {
    const data = setup([])
    data.licensee.output.content.matched_files = null
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {})
  })

  it('should throw for invalid data', () => {
    try {
      summarizer.summarize(null, {})
      assert.equal(true, false)
    } catch (error) {
      assert.equal(error.message, 'Invalid Licensee data')
    }
  })
})

// TOOD Add tests for merging the license data into files etc.

function setup(files, attachments) {
  const matched_files = files.map(file => {
    return {
      filename: file.path,
      matcher: { name: file.matcher || 'exact', confidence: file.confidence || '100' },
      matched_license: file.license
    }
  })
  return { licensee: { version: '1.2.3', output: { content: { matched_files } } }, attachments }
}
