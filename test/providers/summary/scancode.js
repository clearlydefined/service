// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../../providers/summary/scancode')()
summarizer.logger = { info: () => {} }
const fs = require('fs')
const path = require('path')
const { get, uniq, flatten } = require('lodash')

const scancodeVersions = ['2.2.1', '2.9.2', '2.9.8', '3.0.0', '3.0.2']

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

function getHarvestData(version, test) {
  const fileName = path.join(__dirname, `../../fixtures/scancode/${version}/${test}.json`)
  if (fs.existsSync(fileName)) {
    return JSON.parse(fs.readFileSync(fileName))
  }
}
