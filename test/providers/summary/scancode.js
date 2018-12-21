// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../../providers/summary/scancode')()
summarizer.logger = { info: () => {} }
const fs = require('fs')
const path = require('path')
const { uniq, flatten } = require('lodash')

const scancodeVersions = ['2.2.1', '2.9.2', '2.9.8']

describe('ScancodeSummarizer expected summary from fixtures', () => {
  it('summarizes basic npm', () => {
    const coordinates = { type: 'npm', provider: 'npmjs' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'npm-basic')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(result.licensed.declared, 'ISC', `Declared license mismatch for version ${version}`)
      assert.equal(result.described.releaseDate, '2017-05-19', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 1)
    }
  })

  it('summarizes large npm', () => {
    const coordinates = { type: 'npm', provider: 'npmjs' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'npm-large')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)
      assert.equal(
        result.licensed.declared,
        'BSD-3-Clause OR GPL-2.0',
        `Declared license mismatch for version ${version}`
      )
      assert.equal(result.described.releaseDate, '2018-03-30', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 33)
    }
  })

  it('summarizes ruby gems', () => {
    const coordinates = { type: 'gem', provider: 'rubygems' }
    for (let version of scancodeVersions) {
      const harvestData = getHarvestData(version, 'gem')
      if (!harvestData) continue
      const result = summarizer.summarize(coordinates, harvestData)

      assert.equal(result.files.find(x => x.path === 'MIT-LICENSE.md').license, 'MIT')
      assert.equal(result.described.releaseDate, '2018-08-09', `releaseDate mismatch for version ${version}`)
      assert.deepEqual(uniq(flatten(result.files.map(x => x.attributions))).filter(x => x).length, 3)
    }
  })
})

function getHarvestData(version, test) {
  const fileName = path.join(__dirname, `../../fixtures/scancode/${version}/${test}.json`)
  if (fs.existsSync(fileName)) {
    return JSON.parse(fs.readFileSync(fileName))
  }
}
