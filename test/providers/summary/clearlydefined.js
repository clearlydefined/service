// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../../providers/summary/clearlydefined')()

describe('ClearlyDescribedSummarizer addLicenseFromFiles', () => {
  it('declares MIT license from license file', () => {
    const result = {}
    const interestingFiles = [{
      path: 'LICENSE',
      token: 'abcd',
      license: 'MIT'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed.declared, 'MIT')
  })

  it('declares MIT license from license file in package folder for npm', () => {
    const result = {}
    const interestingFiles = [{
      path: 'package/LICENSE',
      token: 'abcd',
      license: 'MIT'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles }, { type: 'npm' })
    assert.strictEqual(result.licensed.declared, 'MIT')
  })

  it('declares nothing from license file in package folder for nuget', () => {
    const result = {}
    const interestingFiles = [{
      path: 'package/LICENSE',
      token: 'abcd',
      license: 'MIT'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles }, { type: 'nuget' })
    assert.strictEqual(result.licensed, undefined)
  })

  it('declares spdx license expression from multiple license files', () => {
    const result = {}
    const interestingFiles = [{
      path: 'LICENSE',
      token: 'abcd',
      license: 'MIT'
    },
    {
      path: 'LICENSE.html',
      token: 'abcd',
      license: '0BSD'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed.declared, 'MIT AND 0BSD')
  })

  it('declares single license for multiple similar license files', () => {
    const result = {}
    const interestingFiles = [{
      path: 'LICENSE',
      token: 'abcd',
      license: 'MIT'
    },
    {
      path: 'LICENSE.html',
      token: 'abcd',
      license: 'MIT'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed.declared, 'MIT')
  })

  it('declares nothing from non-license files with valid license', () => {
    const result = {}
    const interestingFiles = [{
      path: 'not-A-License',
      token: 'abcd',
      license: 'MIT'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed, undefined)
  })

  it('declares nothing from license files with no license', () => {
    const result = {}
    const interestingFiles = [{
      path: 'LICENSE',
      token: 'abcd'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed, undefined)
  })

  it('declares nothing from license files with NOASSERTION', () => {
    const result = {}
    const interestingFiles = [{
      path: 'LICENSE',
      token: 'abcd',
      license: 'NOASSERTION'
    }]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed, undefined)
  })
})
