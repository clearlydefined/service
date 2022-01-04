// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../providers/summary/clearlydefined')()
const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')

const testCoordinates = EntityCoordinates.fromString('maven/mavencentral/io.clearlydefined/test/1.0')
describe('ClearlyDescribedSummarizer general behavior', () => {
  it('captures summary info', () => {
    const data = { summaryInfo: { count: 42, k: 5, hashes: { sha1: '1' } } }
    const result = summarizer.summarize(testCoordinates, data)
    assert.strictEqual(result.described.files, 42)
    assert.strictEqual(result.described.k, undefined)
    assert.strictEqual(result.described.hashes.sha1, '1')
  })
})

describe('ClearlyDescribedSummarizer add files', () => {
  it('adds no files', () => {
    const files = {}
    const result = summarizer.summarize(testCoordinates, files)
    assert.strictEqual(!!result.files, false)
  })

  it('adds one file', () => {
    const files = { files: [{ path: 'foo', hashes: { sha1: '1' } }] }
    const result = summarizer.summarize(testCoordinates, files)
    assert.strictEqual(result.files.length, 1)
    assert.strictEqual(result.files[0].path, 'foo')
    assert.strictEqual(result.files[0].hashes.sha1, '1')
  })

  it('adds no attachments', () => {
    const files = {}
    const result = summarizer.summarize(testCoordinates, files)
    assert.strictEqual(!!result.files, false)
  })

  it('does nothing with "extra" attachments', () => {
    const files = { attachments: [{ path: 'LICENSE', token: 'abcd' }] }
    const result = summarizer.summarize(testCoordinates, files)
    assert.strictEqual(!!result.files, false)
  })

  it('does nothing with extra attachments', () => {
    const result = { files: [{ path: 'foo' }] }
    const files = { attachments: [{ path: 'LICENSE', token: 'abcd' }] }
    summarizer.addAttachedFiles(result, files)
    assert.strictEqual(result.files.length, 1)
    assert.strictEqual(result.files[0].path, 'foo')
    assert.strictEqual(!!result.files[0].token, false)
  })

  it('adds token for one file', () => {
    const result = { files: [{ path: 'foo' }] }
    const files = { attachments: [{ path: 'foo', token: 'abcd' }] }
    summarizer.addAttachedFiles(result, files)
    assert.strictEqual(result.files.length, 1)
    assert.strictEqual(result.files[0].path, 'foo')
    assert.strictEqual(result.files[0].token, 'abcd')
  })

  it('adds tokens for multiple files', () => {
    const result = { files: [{ path: 'foo' }, { path: 'bar' }] }
    const files = { attachments: [{ path: 'foo', token: 'abcd' }, { path: 'bar', token: 'dcba' }] }
    summarizer.addAttachedFiles(result, files)
    assert.strictEqual(result.files.length, 2)
    assert.strictEqual(result.files[0].path, 'foo')
    assert.strictEqual(result.files[0].token, 'abcd')
    assert.strictEqual(result.files[1].path, 'bar')
    assert.strictEqual(result.files[1].token, 'dcba')
  })

  it('adds license nature for attachments named license', () => {
    const result = { files: [{ path: 'foo' }, { path: 'LICENSE' }] }
    const files = { attachments: [{ path: 'foo', token: 'abcd' }, { path: 'LICENSE', token: 'dcba' }] }
    summarizer.addAttachedFiles(result, files)
    assert.strictEqual(result.files.length, 2)
    assert.strictEqual(result.files[0].path, 'foo')
    assert.strictEqual(result.files[0].token, 'abcd')
    assert.deepEqual(result.files[0].natures, undefined) // not named a recognized license name
    assert.strictEqual(result.files[1].path, 'LICENSE')
    assert.strictEqual(result.files[1].token, 'dcba')
    assert.deepEqual(result.files[1].natures, ['license'])
  })
})

describe('ClearlyDescribedSummarizer addCrateData', () => {
  const crateTestCoordinates = EntityCoordinates.fromString('crate/cratesio/-/test/1.0')
  it('declares license from registryData', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { license: 'MIT' } }, crateTestCoordinates)
    assert.strictEqual(get(result, 'licensed.declared'), 'MIT')
  })

  it('declares dual license from registryData with SPDX expression', () => {
    let result = {}
    let data = setup([{ path: 'LICENSE-MIT', license: 'MIT' }, { path: 'LICENSE-APACHE', license: 'Apache-2.0' }])
    data.registryData = { license: 'MIT OR Apache-2.0' }
    summarizer.addCrateData(result, data, crateTestCoordinates)
    assert.strictEqual(get(result, 'licensed.declared'), 'MIT OR Apache-2.0')
  })

  it('declares dual license from registryData with slash-separated licenses', () => {
    let result = {}
    let data = setup([{ path: 'LICENSE-MIT', license: 'MIT' }, { path: 'LICENSE-APACHE', license: 'Apache-2.0' }])
    data.registryData = { license: 'MIT/Apache-2.0' }
    summarizer.addCrateData(result, data, crateTestCoordinates)
    assert.strictEqual(get(result, 'licensed.declared'), 'MIT OR Apache-2.0')
  })

  it('normalizes to spdx only', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { license: 'Garbage' } }, crateTestCoordinates)
    assert.strictEqual(get(result, 'licensed.declared'), 'NOASSERTION')
  })

  it('normalizes to spdx only with slashes', () => {
    let result = {}
    summarizer.addCrateData(result, { registryData: { license: 'Garbage/Junk' } }, crateTestCoordinates)
    assert.strictEqual(get(result, 'licensed.declared'), 'NOASSERTION OR NOASSERTION')
  })

  it('describes projectWebsite from manifest', () => {
    let result = {}
    summarizer.addCrateData(result, { manifest: { homepage: 'https://github.com/owner/repo' } }, crateTestCoordinates)
    assert.strictEqual(result.described.projectWebsite, 'https://github.com/owner/repo')
  })

  it('describes releaseDate from registryData', () => {
    let result = {}
    summarizer.addCrateData(
      result,
      { registryData: { created_at: '2018-06-01T21:41:57.990052+00:00' } },
      crateTestCoordinates
    )
    assert.strictEqual(result.described.releaseDate, '2018-06-01')
  })
})

describe('ClearlyDescribedSummarizer addComposerData', () => {
  const composerTestCoordinates = EntityCoordinates.fromString('composer/packagist/vendor/test/1.0')

  it('does not declare license when manifest is silent on the license', () => {
    let result = {}
    summarizer.addComposerData(result, { registryData: { manifest: {} } }, composerTestCoordinates)

    assert.strictEqual(get(result, 'licensed.declared'), undefined)
  })

  it('declares license from registryData that is a singular license as a string', () => {
    let result = {}
    summarizer.addComposerData(result, { registryData: { manifest: { license: 'MIT' } } }, composerTestCoordinates)

    assert.strictEqual(get(result, 'licensed.declared'), 'MIT')
  })

  it('declares license from registryData that is a singular license in an array', () => {
    let result = {}
    summarizer.addComposerData(result, { registryData: { manifest: { license: ['MIT'] } } }, composerTestCoordinates)

    assert.strictEqual(get(result, 'licensed.declared'), 'MIT')
  })

  it('declares dual license from registryData', () => {
    let result = {}
    summarizer.addComposerData(
      result,
      { registryData: { manifest: { license: ['MIT', 'Apache-2.0'] } } },
      composerTestCoordinates
    )
    assert.strictEqual(get(result, 'licensed.declared'), 'MIT OR Apache-2.0')
  })

  it('normalizes to spdx only', () => {
    let result = {}
    summarizer.addComposerData(
      result,
      { registryData: { manifest: { license: ['Garbage'] } } },
      composerTestCoordinates
    )
    assert.strictEqual(get(result, 'licensed.declared'), 'NOASSERTION')
  })

  it('normalizes to spdx only with slashes', () => {
    let result = {}
    summarizer.addComposerData(
      result,
      { registryData: { manifest: { license: ['Garbage/Junk'] } } },
      composerTestCoordinates
    )
    assert.strictEqual(get(result, 'licensed.declared'), 'NOASSERTION')
  })

  it('normalizes to spdx only with slashes', () => {
    let result = {}
    summarizer.addComposerData(
      result,
      { registryData: { manifest: { license: ['Garbage', 'Junk'] } } },
      composerTestCoordinates
    )
    assert.strictEqual(get(result, 'licensed.declared'), 'NOASSERTION OR NOASSERTION')
  })

  it('describes projectWebsite from manifest', () => {
    let result = {}
    summarizer.addComposerData(
      result,
      { registryData: { manifest: { homepage: 'https://github.com/owner/repo' } } },
      composerTestCoordinates
    )
    assert.strictEqual(result.described.projectWebsite, 'https://github.com/owner/repo')
  })

  it('describes releaseDate from registryData', () => {
    let result = {}
    summarizer.addComposerData(
      result,
      { registryData: { releaseDate: '2018-06-01T21:41:57.990052+00:00' } },
      composerTestCoordinates
    )
    assert.strictEqual(result.described.releaseDate, '2018-06-01')
  })
})

describe('ClearlyDescribedSummarizer addNpmData', () => {
  const npmTestCoordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0')
  const expectedUrls = {
    download: 'https://registry.npmjs.com/test/-/test-1.0.tgz',
    registry: 'https://npmjs.com/package/test',
    version: 'https://npmjs.com/package/test/v/1.0'
  }
  const expectedResult = { described: { urls: expectedUrls } }
  it('should set declared license from manifest', () => {
    // prettier-ignore
    const data = {
      'MIT': 'MIT',
      'mit': 'MIT',
      'MIT AND Apache-2.0': 'MIT AND Apache-2.0',
      'See license': 'NOASSERTION',
      'NOASSERTION': 'NOASSERTION',
      '': null,
      ' ': null
    }

    for (let license of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { manifest: { license: license } } }, npmTestCoordinates)
      if (data[license])
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[license] }
        })
      else assert.deepEqual(result, expectedResult)
    }

    for (let license of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { manifest: { license: { type: license } } } }, npmTestCoordinates)
      if (data[license])
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[license] }
        })
      else assert.deepEqual(result, expectedResult)
    }

    for (let license of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { manifest: { licenses: license } } }, npmTestCoordinates)
      if (data[license]) {
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[license] }
        })
      }
      else assert.deepEqual(result, expectedResult)
    }

    for (let license of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { manifest: { licenses: { type: license } } } }, npmTestCoordinates)
      if (data[license]) {
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[license] }
        })
      }
      else assert.deepEqual(result, expectedResult)
    }

    const licenseArray = ['MIT']
    let result = {}
    summarizer.addNpmData(result, { registryData: { manifest: { license: licenseArray } } }, npmTestCoordinates)
    assert.deepEqual(result, { ...expectedResult, licensed: { declared: 'MIT' } })

    const licenseArray2 = ['MIT', 'Apache-2.0']
    let result2 = {}
    summarizer.addNpmData(result2, { registryData: { manifest: { license: licenseArray2 } } }, npmTestCoordinates)
    assert.deepEqual(result2, { ...expectedResult, licensed: { declared: 'MIT AND Apache-2.0' } })

    let result3 = {}
    summarizer.addNpmData(result3, { registryData: { manifest: { license: { type: licenseArray2 } } } }, npmTestCoordinates)
    assert.deepEqual(result3, { ...expectedResult, licensed: { declared: 'MIT AND Apache-2.0' } })

    let result4 = {}
    summarizer.addNpmData(result4, { registryData: { manifest: { licenses: licenseArray2 } } }, npmTestCoordinates)
    assert.deepEqual(result4, { ...expectedResult, licensed: { declared: 'MIT AND Apache-2.0' } })

    const licenseArray3 = [{ type: 'MIT' }, { type: 'Apache-2.0' }]
    let result5 = {}
    summarizer.addNpmData(result5, { registryData: { manifest: { licenses: licenseArray3 } } }, npmTestCoordinates)
    assert.deepEqual(result5, { ...expectedResult, licensed: { declared: 'MIT AND Apache-2.0' } })
  })

  it('should set release date', () => {
    // prettier-ignore
    const data = {
      '2018-01-09T17:18:33.930Z': '2018-01-09',
      // TODO this causes moment to throw a warning as it is not an ISO date. Note sure if this date format
      // is something we will/do see and if so, what we should do about it. Some fallback processing?
      // It's a bit bogus that moment is throwing this to the console with no way to turn off.
      '2018-01-08': '2018-01-08',
      'JUNK': null
    }
    for (let date of Object.keys(data)) {
      let result = {}
      summarizer.addNpmData(result, { registryData: { releaseDate: date } }, npmTestCoordinates)
      const expected = {
        described: {
          urls: expectedUrls
        }
      }
      if (data[date] !== null) expected.described.releaseDate = data[date]
      assert.deepEqual(result, expected)
    }
  })

  it('should set projectWebsite', () => {
    let result = {}
    summarizer.addNpmData(
      result,
      { registryData: { manifest: { homepage: 'https://github.com/project/repo' } } },
      npmTestCoordinates
    )
    assert.deepEqual(result, {
      described: {
        urls: expectedUrls,
        projectWebsite: 'https://github.com/project/repo'
      }
    })
  })

  it('should set issueTracker if it is http', () => {
    let result = {}
    summarizer.addNpmData(
      result,
      { registryData: { manifest: { bugs: 'https://github.com/project/repo/issues' } } },
      npmTestCoordinates
    )
    assert.deepEqual(result, {
      described: {
        urls: expectedUrls,
        issueTracker: 'https://github.com/project/repo/issues'
      }
    })

    let resul2 = {}
    summarizer.addNpmData(
      resul2,
      { registryData: { manifest: { bugs: 'nothttps://github.com/project/repo/issues' } } },
      npmTestCoordinates
    )
    assert.deepEqual(resul2, expectedResult)
  })

  it('should set issueTracker if it is url or email', () => {
    let result = {}
    summarizer.addNpmData(
      result,
      {
        registryData: {
          manifest: { bugs: { url: 'https://github.com/project/repo/issues', email: 'bugs@project.com' } }
        }
      },
      npmTestCoordinates
    )
    assert.deepEqual(result, {
      described: {
        urls: expectedUrls,
        issueTracker: 'https://github.com/project/repo/issues'
      }
    })

    let result2 = {}
    summarizer.addNpmData(
      result2,
      { registryData: { manifest: { bugs: { email: 'bugs@project.com' } } } },
      npmTestCoordinates
    )
    assert.deepEqual(result2, {
      described: {
        urls: expectedUrls,
        issueTracker: 'bugs@project.com'
      }
    })
  })

  it('should not set issueTracker if it is not http', () => { })

  it('should return if no registry data', () => {
    let result = {}
    summarizer.addNpmData(result, {}, npmTestCoordinates)
    assert.deepEqual(result, {})
    summarizer.addNpmData(result, { registryData: {} }, npmTestCoordinates)
    assert.deepEqual(result, expectedResult)
  })
})

describe('ClearlyDescribedSummarizer addNuGetData', () => {
  const nugetTestCoordinates = EntityCoordinates.fromString('nuget/nuget/-/test/1.0')
  const expectedUrls = {
    registry: 'https://nuget.org/packages/test',
    version: 'https://nuget.org/packages/test/1.0',
    download: 'https://nuget.org/api/v2/package/test/1.0'
  }
  const expectedResult = {
    described: {
      urls: expectedUrls
    }
  }
  it('should set declared license from manifest licenseExpression', () => {
    // prettier-ignore
    const data = {
      'MIT': 'MIT',
      'mit': 'MIT',
      'MIT AND Apache-2.0': 'MIT AND Apache-2.0',
      'MIT OR Apache-2.0': 'MIT OR Apache-2.0',
      'See license': 'NOASSERTION',
      'NOASSERTION': 'NOASSERTION',
      '': null,
      ' ': null
    }

    for (let licenseExpression of Object.keys(data)) {
      let result = {}
      summarizer.addNuGetData(result, { manifest: { licenseExpression } }, nugetTestCoordinates)
      if (data[licenseExpression])
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[licenseExpression] }
        })
      else assert.deepEqual(result, expectedResult)
    }
  })

  it('should set declared license from manifest licenseUrl', () => {
    // prettier-ignore
    const data = {
      'https://opensource.org/licenses/MIT': 'MIT',
      'https://www.apache.org/licenses/LICENSE-2.0': 'Apache-2.0',
      'See license': 'NOASSERTION',
      'NOASSERTION': 'NOASSERTION',
      '': null,
      ' ': null
    }

    for (let licenseUrl of Object.keys(data)) {
      let result = {}
      summarizer.addNuGetData(result, { manifest: { licenseUrl } }, nugetTestCoordinates)
      if (data[licenseUrl])
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[licenseUrl] }
        })
      else assert.deepEqual(result, expectedResult)
    }
  })
})

describe('ClearlyDescribedSummarizer addMavenData', () => {
  const expectedUrls = {
    download: 'https://repo1.maven.org/maven2/io/clearlydefined/test/1.0/test-1.0.jar',
    registry: 'https://repo1.maven.org/maven2/io/clearlydefined/test',
    version: 'https://repo1.maven.org/maven2/io/clearlydefined/test/1.0',
  }
  const expectedResult = { described: { urls: expectedUrls } }
  it('should set declared license from manifest licenseUrl', () => {
    const data = {
      'https://opensource.org/licenses/MIT': 'MIT',
      'https://www.apache.org/licenses/LICENSE-2.0': 'Apache-2.0',
      'See license': null,
      NOASSERTION: null,
      '': null,
      ' ': null
    }

    for (let url of Object.keys(data)) {
      let result = {}
      summarizer.addMavenData(
        result,
        { manifest: { summary: { project: { licenses: [{ license: { url } }] } } } },
        testCoordinates
      )
      if (data[url])
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[url] }
        })
      else assert.deepEqual(result, expectedResult)
    }
  })

  it('should set declared license from manifest license name', () => {
    const data = new Map([
      [[{ license: { name: 'MIT' } }], 'MIT'],
      [[{ license: { name: 'MIT License' } }], 'MIT'],
      [[{ license: { name: 'Apache-2.0' } }], 'Apache-2.0'],
      [[{ license: { name: 'MIT' } }, { license: { name: 'Apache-2.0' } }], 'MIT OR Apache-2.0'],
      [[{ license: { name: 'MIT' } }, { license: { name: 'Garbage' } }], 'MIT OR NOASSERTION'],
      [[{ license: { name: 'My favorite license' } }], 'NOASSERTION'],
      [[{ license: { name: 'See license' } }], 'NOASSERTION'],
      [[{ license: { name: 'NOASSERTION' } }], 'NOASSERTION'],
      [[{ license: { name: '' } }], null],
      [[{ license: { name: ' ' } }], null]
    ])

    data.forEach((expected, licenses) => {
      let result = {}
      summarizer.addMavenData(result, { manifest: { summary: { project: { licenses } } } }, testCoordinates)
      if (expected)
        assert.deepEqual(result, {
          described: {
            urls: expectedUrls
          },
          licensed: { declared: expected }
        })
      else assert.deepEqual(result, expectedResult)
    })
  })
})

describe('ClearlyDescribedSummarizer addMavenData', () => {
  const testCoordinatesMavenGoogle = EntityCoordinates.fromString('maven/mavenGoogle/io.clearlydefined/test/1.0')
  const expectedUrls = {
    download: 'https://maven.google.com/web/index.html#io.clearlydefined:test:1.0',
    registry: 'https://maven.google.com/web/index.html#io.clearlydefined:test:1.0',
    version: 'https://maven.google.com/web/index.html#io.clearlydefined:test:1.0/1.0',
  }
  const expectedResult = { described: { urls: expectedUrls } }
  it('should set declared license from manifest licenseUrl', () => {
    const data = {
      'https://opensource.org/licenses/MIT': 'MIT',
      'https://www.apache.org/licenses/LICENSE-2.0': 'Apache-2.0',
      'See license': null,
      NOASSERTION: null,
      '': null,
      ' ': null
    }

    for (let url of Object.keys(data)) {
      let result = {}
      summarizer.addMavenData(
        result,
        { manifest: { summary: { project: { licenses: [{ license: { url } }] } } } },
        testCoordinatesMavenGoogle
      )
      if (data[url])
        assert.deepEqual(result, {
          ...expectedResult,
          licensed: { declared: data[url] }
        })
      else assert.deepEqual(result, expectedResult)
    }
  })

  it('should set declared license from manifest license name', () => {
    const data = new Map([
      [[{ license: { name: 'MIT' } }], 'MIT'],
      [[{ license: { name: 'MIT License' } }], 'MIT'],
      [[{ license: { name: 'Apache-2.0' } }], 'Apache-2.0'],
      [[{ license: { name: 'MIT' } }, { license: { name: 'Apache-2.0' } }], 'MIT OR Apache-2.0'],
      [[{ license: { name: 'MIT' } }, { license: { name: 'Garbage' } }], 'MIT OR NOASSERTION'],
      [[{ license: { name: 'My favorite license' } }], 'NOASSERTION'],
      [[{ license: { name: 'See license' } }], 'NOASSERTION'],
      [[{ license: { name: 'NOASSERTION' } }], 'NOASSERTION'],
      [[{ license: { name: '' } }], null],
      [[{ license: { name: ' ' } }], null]
    ])

    data.forEach((expected, licenses) => {
      let result = {}
      summarizer.addMavenData(result, { manifest: { summary: { project: { licenses } } } }, testCoordinatesMavenGoogle)
      if (expected)
        assert.deepEqual(result, {
          described: {
            urls: expectedUrls
          },
          licensed: { declared: expected }
        })
      else assert.deepEqual(result, expectedResult)
    })
  })
})

describe('ClearlyDescribedSummarizer addSourceArchiveData', () => {
  const expectedUrls = {
    download: 'https://repo1.maven.org/maven2/io/clearlydefined/test/1.0/test-1.0.jar',
    registry: 'https://repo1.maven.org/maven2/io/clearlydefined/test',
    version: 'https://repo1.maven.org/maven2/io/clearlydefined/test/1.0',
  }

  const expectedResult = { described: { urls: expectedUrls } }
  it('should set the correct urls', () => {
    const data = {
      'https://opensource.org/licenses/MIT': 'MIT',
    }

    for (let url of Object.keys(data)) {
      let result = {}
      summarizer.addSourceArchiveData(
        result,
        { manifest: { summary: { project: { licenses: [{ license: { url } }] } } } },
        testCoordinates
      )
      if (data[url])
        assert.deepEqual(result, {
          ...expectedResult,
        })
      else assert.deepEqual(result, expectedResult)
    }
  })
})

describe('ClearlyDescribedSummarizer addDebData', () => {
  const debTestCoordinates = EntityCoordinates.fromString('deb/debian/-/test/1.0_arch')
  it('describes releaseDate from data', () => {
    let result = {}
    summarizer.addDebData(result, { releaseDate: '2018-06-01T21:41:57.990052+00:00' }, debTestCoordinates)
    assert.strictEqual(result.described.releaseDate, '2018-06-01')
  })
})

describe('ClearlyDescribedSummarizer addDebSrcData', () => {
  const debsrcTestCoordinates = EntityCoordinates.fromString('debsrc/debian/-/test/1.0')
  it('describes releaseDate from data', () => {
    let result = {}
    summarizer.addDebSrcData(result, { releaseDate: '2018-06-01T21:41:57.990052+00:00' }, debsrcTestCoordinates)
    assert.strictEqual(result.described.releaseDate, '2018-06-01')
  })
})

describe('ClearlyDescribedSummarizer addGitData', () => {
  const testCoordinatesGit = EntityCoordinates.fromString('git/github/test_namespace/test/71eee1980b')

  const expectedUrls = {
    download: 'https://github.com/test_namespace/test/archive/71eee1980b.zip',
    registry: 'https://github.com/test_namespace/test',
    version: 'https://github.com/test_namespace/test/tree/71eee1980b'
  }
  const expectedResult = { described: { urls: expectedUrls } }

  it('should set the correct urls', () => {
    const data = {
      'https://opensource.org/licenses/MIT': 'MIT',
    }

    for (let url of Object.keys(data)) {
      let result = {}
      summarizer.addGitData(
        result,
        { manifest: { summary: { project: { licenses: [{ license: { url } }] } } } },
        testCoordinatesGit
      )
      if (data[url])
        assert.deepEqual(result, {
          ...expectedResult,
        })
      else assert.deepEqual(result, expectedResult)
    }
  })

  it('describes releaseDate from data', () => {
    let result = {}
    summarizer.addGitData(result, { releaseDate: '2018-06-01T21:41:57.990052+00:00' }, testCoordinatesGit)
    assert.strictEqual(result.described.releaseDate, '2018-06-01')
  })
})

describe('ClearlyDescribedSummarizer addGitData', () => {
  const testCoordinatesGitLab = EntityCoordinates.fromString('git/gitlab/test_namespace/test/71eee1980b')

  const expectedUrls = {
    download: 'https://gitlab.com/test_namespace/test/-/archive/71eee1980b/test-71eee1980b.zip',
    registry: 'https://gitlab.com/test_namespace/test',
    version: 'https://gitlab.com/test_namespace/test/-/tree/71eee1980b'
  }

  const expectedResult = { described: { urls: expectedUrls } }

  it('should set the correct urls', () => {
    const data = {
      'https://opensource.org/licenses/MIT': 'MIT',
    }

    for (let url of Object.keys(data)) {
      let result = {}
      summarizer.addGitData(
        result,
        { manifest: { summary: { project: { licenses: [{ license: { url } }] } } } },
        testCoordinatesGitLab
      )
      if (data[url])
        assert.deepEqual(result, {
          ...expectedResult,
        })
      else assert.deepEqual(result, expectedResult)
    }
  })
})

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


describe('ClearlyDescribedSummarizer addGoData', () => {
  const testCoordinatesGo = EntityCoordinates.fromString('go/golang/rsc.io/quote/v1.3.0')

  const expectedUrls = {
    download: 'https://proxy.golang.org/rsc.io/quote/@v/v1.3.0.zip',
    registry: 'https://pkg.go.dev/rsc.io/quote',
    version: 'https://pkg.go.dev/rsc.io/quote@v1.3.0'
  }

  const expectedResult = { described: { urls: expectedUrls } }

  it('should set the correct urls', () => {
    const data = {
      'https://opensource.org/licenses/MIT': 'MIT',
    }

    for (let url of Object.keys(data)) {
      let result = {}
      summarizer.addGoData(
        result,
        { manifest: { summary: { project: { licenses: [{ license: { url } }] } } } },
        testCoordinatesGo
      )
      if (data[url])
        assert.deepEqual(result, {
          ...expectedResult,
        })
      else assert.deepEqual(result, expectedResult)
    }
  })

  it('should handle url encoding in the coordinates', () => {
    const testEncodedCoordinatesGo = EntityCoordinates.fromString('go/golang/golang.org%2fx/net/v0.0.0-20210226172049-e18ecbb05110')

    const expectedDecodedUrls = {
      download: 'https://proxy.golang.org/golang.org/x/net/@v/v0.0.0-20210226172049-e18ecbb05110.zip',
      registry: 'https://pkg.go.dev/golang.org/x/net',
      version: 'https://pkg.go.dev/golang.org/x/net@v0.0.0-20210226172049-e18ecbb05110'
    }

    const expectedDecodedResult = { described: { urls: expectedDecodedUrls } }

    const testData = {
      'https://opensource.org/licenses/MIT': 'MIT',
    }

    for (let url of Object.keys(testData)) {
      let result = {}
      summarizer.addGoData(
        result,
        { manifest: { summary: { project: { licenses: [{ license: { url } }] } } } },
        testEncodedCoordinatesGo
      )
      if (testData[url])
        assert.deepEqual(result, {
          ...expectedDecodedResult,
        })
      else assert.deepEqual(result, expectedDecodedResult)
    }
  })

  it('gets releaseDate from data', () => {
    let result = {}
    summarizer.addGoData(result, { releaseDate: '2018-06-01T21:41:57.990052+00:00' }, testCoordinatesGo)
    assert.strictEqual(result.described.releaseDate, '2018-06-01')
  })
})
