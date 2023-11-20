// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../../providers/summary/scancode')()
summarizer.logger = { info: () => { } }
const fs = require('fs')
const path = require('path')
const { get, uniq, flatten } = require('lodash')
const { expect } = require('chai')

const scancodeVersions = ['2.2.1', '2.9.2', '2.9.8', '3.0.0', '3.0.2', '30.1.0']

describe('ScancodeSummarizer basic compatability', () => {
  it('summarizes basic npm', () => {
    const coordinates = { type: 'npm', provider: 'npmjs' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'npm-basic')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'ISC', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2017-05-19', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 1)
      assert.deepEqual(result.files.find(x => x.path === 'package/LICENSE').natures, ['license'])
      assert.equal(flatten(result.files.map(x => x.natures)).filter(x => x).length, 1)
    }
  })

  it('summarizes large npm', () => {
    // let's drop in a 2.9.2 and a 3.0.0 version of https://github.com/RedisLabsModules/RediSearch/tree/v1.4.3
    // this won't have a declared license, since it is common clause, but it will have natures and attributions, etc
    //3.00 is the one that is pending, need to run it locally
    // curl -d '{"type":"scancode", "url":"cd:/git/github/RedisLabsModules/RediSearch/v1.4.3"}' -H "Content-Type: application/json" -H "X-token: secret" -X POST http://localhost:5000/requests

    const coordinates = { type: 'npm', provider: 'npmjs' }
    const overrides = {
      '2.9.2': 'BSD-3-Clause AND GPL-2.0-only'
    }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'npm-large')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(
        result.licensed.declared,
        overrides[version] || 'BSD-3-Clause OR GPL-2.0',
        `Declared license mismatch for version ${version}`
      )
      assert.equal(result.described.releaseDate, '2018-03-31', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 33)
      assert.deepEqual(result.files.find(x => x.path === 'package/LICENSE').natures, ['license'])
      assert.equal(flatten(result.files.map(x => x.natures)).filter(x => x).length, 1)
    }
  })

  it('summarizes maven with a complex declared license in later versions of ScanCode', () => {
    const coordinates = { type: 'maven', provider: 'mavencentral' }
    const harvestData = getHarvestData('30.1.0', 'maven-complex-declared-license')
    const result = summarizer.summarize(coordinates, harvestData)

    assert.equal(
      result.licensed.declared,
      'MIT'
    )
  })

  it('summarizes github with a single declared license in later versions of ScanCode', () => {
    const coordinates = { type: 'git', provider: 'github' }
    const harvestData = getHarvestData('30.1.0', 'github-single-declared-license')
    const result = summarizer.summarize(coordinates, harvestData)

    assert.equal(
      result.licensed.declared,
      'MIT'
    )
  })

  it('should detect license from maven license file in version 30.1.0 of ScanCode', () => {
    const coordinates = { type: 'maven', provider: 'mavencentral' }
    const harvestData = getHarvestData('30.1.0', 'maven-flywaydb-file-license')
    const result = summarizer.summarize(coordinates, harvestData)
    assert.equal(result.licensed.declared, 'Apache-2.0')
  })

  it('throws an error on an invalid scancode version', () => {
    const version = '0.0.0'
    const coordinates = { type: 'npm', provider: 'npmjs' }
    const harvestData = getHarvestData(version, 'npm-basic')
    try {
      summarizer.summarize(coordinates, harvestData)
      throw new Error('Invalid version of ScanCode')
    } catch (error) {
      expect(error.message).to.eq('Invalid version of ScanCode')
    }
  })

  it('summarizes ruby gems', () => {
    const coordinates = { type: 'gem', provider: 'rubygems' }
    const undefinedOverrides = ['2.9.2', '2.9.8']
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'gem')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)

      assert.equal(
        get(result.licensed, 'declared'),
        undefinedOverrides.indexOf(version) > -1 ? undefined : 'MIT',
        `Declared license mismatch for version ${version}`
      )
      assert.equal(result.files.find(x => x.path === 'MIT-LICENSE.md').license, 'MIT')
      assert.equal(result.described.releaseDate, '2018-08-09', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 3)
    }
  })

  it('summarizes git repos', () => {
    const coordinates = { type: 'git', provider: 'github' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'git')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'ISC', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2017-02-24', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 1)
      assert.deepEqual(result.files.find(x => x.path === 'LICENSE').natures, ['license'])
      assert.equal(flatten(result.files.map(x => x.natures)).filter(x => x).length, 1)
    }
  })

  it('summarizes pythons', () => {
    const coordinates = { type: 'pypi', provider: 'pypi', name: 'redis', revision: '3.0.1' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'python')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'MIT', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2018-11-15', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 1)
      assert.deepEqual(result.files.find(x => x.path === 'redis-3.0.1/LICENSE').natures, ['license'])
      assert.equal(flatten(result.files.map(x => x.natures)).filter(x => x).length, 1)
    }
  })
})

describe('ScancodeSummarizer fixtures', () => {
  it('summarizes basic npm 3.0.2', () => {
    const coordinates = { type: 'npm', provider: 'npmjs', name: 'glob', revision: '7.1.2' }
    const harvestData = getHarvestData('3.0.2', 'npm-basic')
    const result = summarizer.summarize(coordinates, harvestData)
    assert.deepEqual(result, {
      described: { releaseDate: '2017-05-19' },
      licensed: { declared: 'ISC' },
      files: [
        { path: 'package/changelog.md', hashes: { sha1: '97bfa68176e50777c07a7ba58f98ff7a1730ac00' } },
        { path: 'package/common.js', hashes: { sha1: '2f948b495467f2a7ac0afbb1008af557ab040143' } },
        { path: 'package/glob.js', hashes: { sha1: 'c2e95cdccba36eaca7b12e2bcf9b383438cee52d' } },
        {
          path: 'package/LICENSE',
          license: 'ISC',
          natures: ['license'],
          attributions: ['Copyright (c) Isaac Z. Schlueter and Contributors'],
          hashes: { sha1: 'bb408e929caeb1731945b2ba54bc337edb87cc66' }
        },
        { path: 'package/package.json', hashes: { sha1: '844f90fa8a6fbf45d581593a333f69c5cb1f2d58' } },
        { path: 'package/README.md', hashes: { sha1: '449f1592c9cf2d32a0d74bead66d7267218f2c4f' } },
        { path: 'package/sync.js', hashes: { sha1: '7482bc56682b97175655976b07044afcb65b0cc9' } }
      ]
    })
  })

  it('summarizes basic npm 30.1.0', () => {
    const coordinates = { type: 'npm', provider: 'npmjs', name: 'glob', revision: '7.1.2' }
    const harvestData = getHarvestData('30.1.0', 'npm-basic')
    const result = summarizer.summarize(coordinates, harvestData)
    //console.log(result)
    assert.deepEqual(result, {
      described: { releaseDate: '2017-05-19' },
      licensed: { declared: 'ISC' },
      files: [
        { path: 'package/changelog.md', license: 'ISC', hashes: { sha1: '97bfa68176e50777c07a7ba58f98ff7a1730ac00' } },
        { path: 'package/common.js', hashes: { sha1: '2f948b495467f2a7ac0afbb1008af557ab040143' } },
        { path: 'package/glob.js', hashes: { sha1: 'c2e95cdccba36eaca7b12e2bcf9b383438cee52d' } },
        {
          path: 'package/LICENSE',
          license: 'ISC',
          natures: ['license'],
          attributions: ['Copyright (c) Isaac Z. Schlueter and Contributors'],
          hashes: { sha1: 'bb408e929caeb1731945b2ba54bc337edb87cc66' }
        },
        { path: 'package/package.json', license: 'ISC', hashes: { sha1: '844f90fa8a6fbf45d581593a333f69c5cb1f2d58' } },
        { path: 'package/README.md', hashes: { sha1: '449f1592c9cf2d32a0d74bead66d7267218f2c4f' } },
        { path: 'package/sync.js', hashes: { sha1: '7482bc56682b97175655976b07044afcb65b0cc9' } }
      ]
    })
  })

  it('summarizes commons-clause as NOASSERTION in 3.0.2', () => {
    const coordinates = {
      type: 'git',
      provider: 'github',
      namespace: 'RedisLabsModules',
      name: 'RediSearch',
      revision: '7f1082687d4779918be0d8109a134d79e6fbcb41'
    }
    const harvestData = getHarvestData('3.0.2', 'commons-clause')
    const result = summarizer.summarize(coordinates, harvestData)
    assert.deepEqual(result.described, { releaseDate: '2019-01-31' })
    assert.deepEqual(result.licensed, { declared: 'NOASSERTION' })
    assert.deepEqual(result.files.length, 576)
    assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 21)
    assert.deepEqual(result.files.filter(x => x.natures), [
      {
        path: 'LICENSE',
        license: 'NOASSERTION',
        natures: ['license'],
        attributions: ['Copyright 2018-2019 Redis Labs Ltd. and Contributors.'],
        hashes: { sha1: '6c9da49858267f91fa10f08ad556f02fdc689e63' }
      },
      {
        path: 'src/dep/friso/LICENSE.md',
        license: 'Apache-2.0 AND MIT',
        natures: ['license'],
        attributions: ['Copyright (c) 2010'],
        hashes: { sha1: 'aeb9db6237c570c389886e0540e01a0ec78134bb' }
      },
      {
        path: 'src/dep/hll/LICENSE',
        license: 'MIT',
        natures: ['license'],
        attributions: ['Copyright (c) 2015 Artem Zaytsev <arepo@nologin.ru>'],
        hashes: { sha1: 'c0e8a4bbdcbc9c81f7ea72b0631f67973aa0f244' }
      },
      {
        path: 'src/dep/libnu/LICENSE',
        license: 'MIT',
        natures: ['license'],
        attributions: ['Copyright (c) 2013 Aleksey Tulinov <aleksey.tulinov@gmail.com>'],
        hashes: { sha1: 'ea1ed91b37e5c99835b9ebf0861f96dfda2524cd' }
      },
      {
        path: 'src/dep/snowball/COPYING',
        license: 'BSD-3-Clause',
        natures: ['license'],
        attributions: ['Copyright (c) 2001, Dr Martin Porter', 'Copyright (c) 2004,2005, Richard Boulton'],
        hashes: { sha1: '3938505906e841002141cb01bbda1e971614e34a' }
      },
      {
        path: 'src/dep/triemap/LICENSE',
        license: 'BSD-2-Clause',
        natures: ['license'],
        attributions: ['Copyright (c) 2017, Redis Labs'],
        hashes: { sha1: 'f35ea366f34f63097146d8b77417d393aab877d3' }
      }
    ])
  })
})

function getHarvestData(version, test) {
  const fileName = path.join(__dirname, `../../fixtures/scancode/${version}/${test}.json`)
  if (fs.existsSync(fileName)) {
    return JSON.parse(fs.readFileSync(fileName))
  }
}
