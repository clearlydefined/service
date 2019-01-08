// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../providers/summary/licensee')()

describe('LicenseeSummarizer', () => {
  it('should skip non-exact and low confidence matches', () => {
    const data = setup([
      { path: 'LICENSE', license: 'MIT' },
      { path: 'foo.txt', license: 'MIT', matcher: 'foo' },
      { path: 'foo.txt', license: 'NOASSERTION', matcher: 'foo' },
      { path: 'bar.txt', license: 'MIT', confidence: '60' }
    ])
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, { files: [{ path: 'LICENSE', license: 'MIT', natures: ['license'] }] })
  })
})

// TOOD Add tests for merging the license data into files etc.

function setup(files) {
  const matched_files = files.map(file => {
    return {
      filename: file.path,
      matcher: { name: file.matcher || 'exact', confidence: file.confidence || '100' },
      matched_license: file.license
    }
  })
  return { licensee: { version: '1.2.3', output: { content: { matched_files } } } }
}
