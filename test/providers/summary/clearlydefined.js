// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../../providers/summary/clearlydefined')()
const { get } = require('lodash')

describe('ClearlyDescribedSummarizer addLicenseFromFiles', () => {
  it('declares MIT license from license file', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'LICENSE',
        token: 'abcd',
        license: 'MIT'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed.declared, 'MIT')
  })

  it('declares MIT license from license file in package folder for npm', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'package/LICENSE',
        token: 'abcd',
        license: 'MIT'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles }, { type: 'npm' })
    assert.strictEqual(result.licensed.declared, 'MIT')
  })

  it('declares nothing from license file in package folder for nuget', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'package/LICENSE',
        token: 'abcd',
        license: 'MIT'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles }, { type: 'nuget' })
    assert.strictEqual(result.licensed, undefined)
  })

  it('declares spdx license expression from multiple license files', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'LICENSE',
        token: 'abcd',
        license: 'MIT'
      },
      {
        path: 'LICENSE.html',
        token: 'abcd',
        license: '0BSD'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed.declared, 'MIT AND 0BSD')
  })

  it('declares single license for multiple similar license files', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'LICENSE',
        token: 'abcd',
        license: 'MIT'
      },
      {
        path: 'LICENSE.html',
        token: 'abcd',
        license: 'MIT'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed.declared, 'MIT')
  })

  it('declares nothing from non-license files with valid license', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'not-A-License',
        token: 'abcd',
        license: 'MIT'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed, undefined)
  })

  it('declares nothing from license files with no license', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'LICENSE',
        token: 'abcd'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed, undefined)
  })

  it('declares nothing from license files with NOASSERTION', () => {
    const result = {}
    const interestingFiles = [
      {
        path: 'LICENSE',
        token: 'abcd',
        license: 'NOASSERTION'
      }
    ]
    summarizer.addLicenseFromFiles(result, { interestingFiles })
    assert.strictEqual(result.licensed, undefined)
  })
})

describe('ClearlyDescribedSummarizer addCrateData', () => {
  it('declares license from registryData', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { license: 'MIT' } })
    assert.strictEqual(get(result, 'licensed.declared'), 'MIT')
  })

  it('declares dual license from registryData', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { license: 'MIT/Apache-2.0' } })
    assert.strictEqual(get(result, 'licensed.declared'), 'MIT OR Apache-2.0')
  })

  it('normalizes to spdx only', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { license: 'Garbage' } })
    assert.strictEqual(get(result, 'licensed.declared'), undefined)
  })

  it('normalizes to spdx only with slashes', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { license: 'Garbage/Junk' } })
    assert.strictEqual(get(result, 'licensed.declared'), undefined)
  })

  it('decribes projectWebsite from manifest', () => {
    let result = {}
    summarizer.addCrateData(result, { manifest: { homepage: 'https://github.com/owner/repo' } })
    assert.strictEqual(result.described.projectWebsite, 'https://github.com/owner/repo')
  })

  it('decribes releaseDate from registryData', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { created_at: '2018-06-01T21:41:57.990052+00:00' } })
    assert.strictEqual(result.described.releaseDate, '2018-06-01')
  })
})

describe('ClearlyDescribedSummarizer addNpmData', () => {
  it('should set declared license from manifest', () => {
    // prettier-ignore
    const data = {
      'MIT': 'MIT',
      'mit': 'MIT',
      'MIT AND Apache-2.0': 'MIT AND Apache-2.0',
      'See license': null,
      'NOASSERTION': null,
      '': null,
      ' ': null
    }

    for (let license of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { manifest: { license: license } } })
      if (data[license]) assert.deepEqual(result, { licensed: { declared: data[license] } })
      else assert.deepEqual(result, {})
    }

    // should work in the type field as well
    for (let license of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { manifest: { license: { type: license } } } })
      if (data[license]) assert.deepEqual(result, { licensed: { declared: data[license] } })
      else assert.deepEqual(result, {})
    }
  })

  it('should set release date', () => {
    // prettier-ignore
    const data = {
      '2018-01-09T17:18:33.930Z': '2018-01-09',
      '2018-01-08': '2018-01-08',
      'JUNK': 'Invalid date' // Is this right behavior?
    }
    for (let date of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { releaseDate: date } })
      assert.deepEqual(result, { described: { releaseDate: data[date] } })
    }
  })

  it('should set projectWebsite', () => {
    let result = {}
    summarizer.addNpmData(result, { registryData: { manifest: { homepage: 'https://github.com/project/repo' } } })
    assert.deepEqual(result, { described: { projectWebsite: 'https://github.com/project/repo' } })
  })

  it('should set issueTracker if it is http', () => {
    let result = {}
    summarizer.addNpmData(result, { registryData: { manifest: { bugs: 'https://github.com/project/repo/issues' } } })
    assert.deepEqual(result, { described: { issueTracker: 'https://github.com/project/repo/issues' } })

    let resul2 = {}
    summarizer.addNpmData(resul2, { registryData: { manifest: { bugs: 'nothttps://github.com/project/repo/issues' } } })
    assert.deepEqual(resul2, {})
  })

  it('should set issueTracker if it is url or email', () => {
    let result = {}
    summarizer.addNpmData(result, {
      registryData: { manifest: { bugs: { url: 'https://github.com/project/repo/issues', email: 'bugs@project.com' } } }
    })
    assert.deepEqual(result, { described: { issueTracker: 'https://github.com/project/repo/issues' } })

    let result2 = {}
    summarizer.addNpmData(result2, { registryData: { manifest: { bugs: { email: 'bugs@project.com' } } } })
    assert.deepEqual(result2, { described: { issueTracker: 'bugs@project.com' } })
  })

  it('should not set issueTracker if it is not http', () => {})

  it('should return if no registry data', () => {
    let result = {}
    summarizer.addNpmData(result, {})
    assert.deepEqual(result, {})
    summarizer.addNpmData(result, { registryData: {} })
    assert.deepEqual(result, {})
  })
})
