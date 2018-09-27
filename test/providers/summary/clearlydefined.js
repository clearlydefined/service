// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../../providers/summary/clearlydefined')()

describe('ClearlyDescribedSummarizer extractLicenseFromFiles', () => {
  it('extracts MIT license from files', () => {
    const files = [{
      path: 'LICENSE',
      token: 'abcd',
      license: 'MIT'
    }]
    const output = summarizer._extractLicenseFromFiles(files)
    assert.equal(output, 'MIT')
  })

  it('extracts falsy from files with no license', () => {
    const files = [{
      path: 'LICENSE',
      token: 'abcd'
    }]
    const output = summarizer._extractLicenseFromFiles(files)
    assert.equal(false, !!output)
  })

  it('extracts falsy from files with NOASSERTION', () => {
    const files = [{
      path: 'LICENSE',
      token: 'abcd',
      license: 'NOASSERTION'
    }]
    const output = summarizer._extractLicenseFromFiles(files)
    assert.equal(false, !!output)
  })
})
