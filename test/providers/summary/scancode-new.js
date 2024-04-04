// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../../providers/summary/scancode')()
summarizer.logger = { info: () => {} }
const fs = require('fs')
const path = require('path')
const { compact, uniq, flatten } = require('lodash')
const { expect } = require('chai')

const scancodeVersions = ['32.0.8']

describe('ScancodeSummarizerNew basic compatability', () => {
  it('summarizes basic npm', () => {
    const coordinates = { type: 'npm', provider: 'npmjs' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'npm-basic')
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'ISC', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2017-05-19', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map((x) => x.attributions))).filter((x) => x).length, 1)
      assert.deepEqual(result.files.find((x) => x.path === 'package/LICENSE').natures, ['license'])
      assert.equal(flatten(result.files.map((x) => x.natures)).filter((x) => x).length, 1)
    }
  })

  it('summarizes large npm', () => {
    const coordinates = { type: 'npm', provider: 'npmjs' }

    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'npm-large')
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(
        result.licensed.declared,
        // TODO: This is wrong and caused by a bug in scancode-toolkit: https://github.com/nexB/scancode-toolkit/issues/3722
        // In the meantime, this specific package's data will be corrected through a manual curation
        'BSD-3-Clause AND GPL-2.0-only AND GPL-1.0-or-later AND BSD-3-Clause AND GPL-2.0-only',
        `Declared license mismatch for version ${version}`
      )
      assert.equal(result.described.releaseDate, '2018-03-31', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map((x) => x.attributions))).filter((x) => x).length, 33)
      assert.deepEqual(result.files.find((x) => x.path === 'package/LICENSE').natures, ['license'])
      assert.equal(flatten(result.files.map((x) => x.natures)).filter((x) => x).length, 1)
    }
  })

  it('summarizes maven with a complex declared license', () => {
    const coordinates = { type: 'maven', provider: 'mavencentral' }
    const harvestData = getHarvestData('32.0.8', 'maven-complex-declared-license')
    const result = summarizer.summarize(coordinates, harvestData)

    assert.equal(result.licensed.declared, 'BSD-3-Clause-No-Nuclear-Warranty AND MIT')
  })

  it('summarizes github with a single declared license', () => {
    const coordinates = { type: 'git', provider: 'github' }
    const harvestData = getHarvestData('32.0.8', 'github-single-declared-license')
    const result = summarizer.summarize(coordinates, harvestData)

    assert.equal(result.licensed.declared, 'MIT')
  })

  it('summarizes pypi with a complex declared license', () => {
    const coordinates = { type: 'pypi', provider: 'pypi' }
    const harvestData = getHarvestData('32.0.8', 'pypi-complex-declared-license')
    const result = summarizer.summarize(coordinates, harvestData)
    assert.equal(result.licensed.declared, 'HPND')
  })

  it('summarizes github with a single declared license', () => {
    const coordinates = { type: 'git', provider: 'github' }
    const harvestData = getHarvestData('32.0.8', 'github-single-declared-license')
    const result = summarizer.summarize(coordinates, harvestData)

    assert.equal(result.licensed.declared, 'MIT')
  })

  it('should detect license from maven license file', () => {
    const coordinates = { type: 'maven', provider: 'mavencentral' }
    const harvestData = getHarvestData('32.0.8', 'maven-flywaydb-file-license')
    const result = summarizer.summarize(coordinates, harvestData)
    assert.equal(result.licensed.declared, 'Apache-2.0')
  })

  it.skip('summarizes using license_expression', () => {
    const coordinates = { type: 'debsrc', provider: 'debian' }
    const harvestData = getHarvestData('32.0.8', 'debsrc-license-expression')
    const result = summarizer.summarize(coordinates, harvestData)
    assert.equal(result.licensed.declared, 'Apache-2.0')
  })

  it('summarizes falling back to license_expression', () => {
    const coordinates = { type: 'git', provider: 'github' }
    const harvestData = getHarvestData('32.0.8', 'github-license-expression')
    const result = summarizer.summarize(coordinates, harvestData)
    // The order of the licenses changed with the new ScanCode version
    assert.equal(result.licensed.declared, 'Apache-2.0 OR MIT')
  })

  it('summarizes license', () => {
    const coordinates = { type: 'git', provider: 'github' }
    const harvestData = getHarvestData('32.0.8', 'github-LatencyUtils-license-expression.')
    const result = summarizer.summarize(coordinates, harvestData)
    assert.equal(result.licensed.declared, '(CC0-1.0 OR BSD-2-Clause) AND BSD-2-Clause')
  })

  it('throws an error on an invalid scancode version', () => {
    const version = '0.0.0'
    const coordinates = { type: 'npm', provider: 'npmjs' }
    const harvestData = getHarvestData(version, 'npm-basic')
    try {
      summarizer.summarize(coordinates, harvestData)
    } catch (error) {
      expect(error.message).to.eq(`Invalid version of ScanCode: ${version}`)
    }
  })

  it('summarizes ruby gems', () => {
    const coordinates = { type: 'gem', provider: 'rubygems' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'gem')
      const result = summarizer.summarize(coordinates, harvestData)

      assert.equal(result.licensed.declared, 'MIT', `Declared license mismatch for version ${version}`)
      assert.equal(result.files.find((x) => x.path === 'MIT-LICENSE.md').license, 'MIT')
      assert.equal(result.described.releaseDate, '2023-07-27', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map((x) => x.attributions))).filter((x) => x).length, 3)
    } 
  })

  it('summarizes git repos', () => {
    const coordinates = { type: 'git', provider: 'github' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'git')
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'MIT', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2021-01-28', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(compact(flatten(result.files.map((x) => x.attributions)))).length, 1)
      assert.deepEqual(result.files.find((x) => x.path === 'LICENSE').natures, ['license'])
      assert.equal(compact(flatten(result.files.map((x) => x.natures))).length, 1)
    }
  })

  it('summarizes pythons', () => {
    const coordinates = { type: 'pypi', provider: 'pypi', name: 'redis', revision: '5.0.1' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'python')
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'MIT', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2023-09-26', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(compact(flatten(result.files.map((x) => x.attributions)))).length, 1)
      assert.deepEqual(result.files.find((x) => x.path === 'redis-5.0.1/LICENSE').natures, ['license'])
      assert.equal(flatten(result.files.map((x) => x.natures)).filter((x) => x).length, 1)
    }
  })

  it('summarizes crates', () => {
    const coordinates = { type: 'crate', provider: 'cratesio', name: 'rand', revision: '0.8.2' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'crate-file-summary')
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'Apache-2.0 AND (Apache-2.0 OR MIT)', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2021-01-13', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(compact(flatten(result.files.map((x) => x.attributions)))).length, 6)
      assert.deepEqual(result.files.find((x) => x.path === 'COPYRIGHT').natures, ['license'])
      assert.deepEqual(result.files.find((x) => x.path === 'LICENSE-APACHE').natures, ['license'])
      assert.deepEqual(result.files.find((x) => x.path === 'LICENSE-MIT').natures, ['license'])
      assert.equal(compact(flatten(result.files.map((x) => x.natures))).length, 3)
    }
  })
})

describe('ScancodeSummarizerNew fixtures', () => {
  it('summarizes basic npm 32.0.8', () => {
    const coordinates = { type: 'npm', provider: 'npmjs', name: 'glob', revision: '7.1.2' }
    const harvestData = getHarvestData('32.0.8', 'npm-basic')
    const result = summarizer.summarize(coordinates, harvestData)
    //console.log(result)
    assert.deepEqual(result, {
      described: { releaseDate: '2017-05-19' },
      licensed: { declared: 'ISC' },
      files: [
        { path: 'package/changelog.md', license: 'ISC', hashes: { sha1: '97bfa68176e50777c07a7ba58f98ff7a1730ac00', sha256: '9cb64aedf3ac2f4e80039a29914f4dacb1780d28d340f757717916cd2ca58f45' } },
        { path: 'package/common.js', hashes: { sha1: '2f948b495467f2a7ac0afbb1008af557ab040143', sha256: 'e9a5f37878266f441069556ea411a60d658bdfb16aa99d3b29b53fd639a5aa3a' } },
        { path: 'package/glob.js', hashes: { sha1: 'c2e95cdccba36eaca7b12e2bcf9b383438cee52d', sha256: 'e3f3d1fd54aa24133a3d518ae7eaf26d5cbc1b9496389e18dd24ba63ea763ed3' } },
        {
          path: 'package/LICENSE',
          license: 'ISC',
          natures: ['license'],
          attributions: ['Copyright (c) Isaac Z. Schlueter and Contributors'],
          hashes: { sha1: 'bb408e929caeb1731945b2ba54bc337edb87cc66', sha256: '4ec3d4c66cd87f5c8d8ad911b10f99bf27cb00cdfcff82621956e379186b016b' }
        },
        { path: 'package/package.json', license: 'MIT AND ISC', hashes: { sha1: '844f90fa8a6fbf45d581593a333f69c5cb1f2d58', sha256: '480d04f663e9461abde03863c44122b239b2fbbf6f309133c654c0595c786c00' } },
        { path: 'package/README.md', hashes: { sha1: '449f1592c9cf2d32a0d74bead66d7267218f2c4f', sha256: '1f0c4810b48885d093a9cf5390f7268bc9b3fc637362a355ed514c9711cc1999' } },
        { path: 'package/sync.js', hashes: { sha1: '7482bc56682b97175655976b07044afcb65b0cc9', sha256: 'f04c04e9e40ea1ada97a1e414ad26d871faa0778e3b1fb0d5fc66ec6acbc243f' } }
      ]
    })
  })
})

function getHarvestData(version, test) {
  const fileName = path.join(__dirname, `../../fixtures/scancode/${version}/${test}.json`)
  if (fs.existsSync(fileName)) {
    return JSON.parse(fs.readFileSync(fileName))
  }
}
