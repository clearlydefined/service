// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
chai.use(deepEqualInAnyOrder)
const { expect } = chai
const Summarizer = require('../../providers/summary/fossology')
const EntityCoordinates = require('../../lib/entityCoordinates')
const validator = require('../../schemas/validator')
const { groupBy, omit } = require('lodash')

describe('General summarizer', () => {
  it('handles empty input', () => {
    const { coordinates, harvested } = setup([])
    const summary = Summarizer().summarize(coordinates, harvested)
    expect(summary.coordinates).to.be.undefined
  })
})

describe('Nomos summarizer', () => {
  it('gets all the per file license info', () => {
    const { coordinates, harvested } = setup([buildNomosFile('foo.txt', 'MIT'), buildNomosFile('bar.txt', 'GPL-3.0')])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([
      { path: 'foo.txt', license: 'MIT' },
      { path: 'bar.txt', license: 'GPL-3.0' }
    ])
  })

  it('does not apply non-spdx licenses', () => {
    const { coordinates, harvested } = setup([
      buildNomosFile('foo.txt', 'No_license_found'),
      buildNomosFile('bar.txt', ' ')
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.eq([{ path: 'foo.txt' }, { path: 'bar.txt' }])
  })

  it('mixes spdx and non-spdx licenses correctly', () => {
    // summary should come out
    const { coordinates, harvested } = setup([
      buildNomosFile('foo.txt', 'No_license_found'),
      buildNomosFile('bar.txt', 'MIT')
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([{ path: 'foo.txt' }, { path: 'bar.txt', license: 'MIT' }])
  })
})

describe('Monk summarizer', () => {
  it('gets all the per file license info', () => {
    const { coordinates, harvested } = setup([buildMonkFile('foo.txt', 'MIT'), buildMonkFile('bar.txt', 'GPL-3.0')])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([
      { path: 'foo.txt', license: 'MIT' },
      { path: 'bar.txt', license: 'GPL-3.0' }
    ])
  })

  it('does not apply non-spdx licenses', () => {
    const { coordinates, harvested } = setup([
      buildMonkFile('foo.txt', 'No_license_found'),
      buildMonkFile('bar.txt', ' ')
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([{ path: 'foo.txt' }, { path: 'bar.txt' }])
  })

  it('mixes spdx and non-spdx licenses correctly', () => {
    // summary should come out
    const { coordinates, harvested } = setup([
      buildMonkFile('foo.txt', 'No_license_found'),
      buildMonkFile('bar.txt', 'MIT')
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([{ path: 'foo.txt' }, { path: 'bar.txt', license: 'MIT' }])
  })
})

describe('Copyright summarizer', () => {
  it('gets all the per file copyright info', () => {
    const { coordinates, harvested } = setup([
      buildCopyrightFile('foo.txt', ['Jane', 'Fred']),
      buildCopyrightFile('bar.txt', ['Bob'])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([
      { path: 'foo.txt', attributions: ['Jane', 'Fred'] },
      { path: 'bar.txt', attributions: ['Bob'] }
    ])
  })
})

describe('Mixed summarization', () => {
  it('merges non-overlapping data', () => {
    const { coordinates, harvested } = setup([
      buildMonkFile('foo.txt', 'MIT'),
      buildNomosFile('bar.txt', 'GPL-3.0'),
      buildCopyrightFile('three.txt', ['Jane'])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([
      { path: 'foo.txt', license: 'MIT' },
      { path: 'bar.txt', license: 'GPL-3.0' },
      { path: 'three.txt', attributions: ['Jane'] }
    ])
  })

  it('merges overlapping data', () => {
    const { coordinates, harvested } = setup([
      buildMonkFile('foo.txt', 'MIT'),
      buildNomosFile('bar.txt', 'GPL-3.0'),
      buildCopyrightFile('foo.txt', ['Bob']),
      buildCopyrightFile('bar.txt', ['Jane'])
    ])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([
      { path: 'foo.txt', license: 'MIT', attributions: ['Bob'] },
      { path: 'bar.txt', license: 'GPL-3.0', attributions: ['Jane'] }
    ])
  })

  it('merges nomos over monk', () => {
    const { coordinates, harvested } = setup([buildMonkFile('foo.txt', 'MIT'), buildNomosFile('foo.txt', 'GPL-3.0')])
    const summary = Summarizer().summarize(coordinates, harvested)
    validate(summary)
    expect(summary.files).to.deep.equalInAnyOrder([{ path: 'foo.txt', license: 'GPL-3.0' }])
  })
})

function validate(definition) {
  // Tack on a dummy coordinates to keep the schema happy. Tool summarizations do not have to include coordinates
  if (!definition.coordinates)
    definition.coordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'foo', revision: '1.0' }
  if (!validator.validate('definition', definition)) throw new Error(validator.errorsText())
}

function setup(files, coordinateSpec) {
  const harvested = { _metadata: {} }
  const grouped = groupBy(files, 'type')
  setupNomos(harvested, grouped.nomos)
  setupMonk(harvested, grouped.monk)
  setupCopyright(harvested, grouped.copyright)
  const coordinates = EntityCoordinates.fromString(coordinateSpec || 'npm/npmjs/-/test/1.0')
  return { coordinates, harvested }
}

function setupNomos(result, data) {
  if (!data) return
  const licenses = data.map(file => file.licenses).filter(e => e)
  result.nomos = {
    version: '3.3.0',
    output: {
      contentType: 'text/plain',
      content: licenses.join('\n')
    }
  }
}

function setupMonk(result, data) {
  if (!data) return
  const content = stripType(data)
  result.monk = {
    version: '3.3.0',
    output: { contentType: 'application/json', content }
  }
}

function setupCopyright(result, data) {
  if (!data) return
  const content = stripType(data)
  result.copyright = {
    version: '3.3.0',
    output: { contentType: 'application/json', content }
  }
}

function stripType(entries) {
  return entries.map(entry => omit(entry, ['type']))
}

function buildNomosFile(path, license) {
  return {
    type: 'nomos',
    path,
    licenses: license ? `File ${path} contains license(s) ${license}` : null
  }
}

function buildMonkFile(path, license, type = 'full') {
  return {
    type: 'monk',
    path,
    output: { type, license }
  }
}

function buildCopyrightFile(path, parties) {
  const entries = parties.map(party => {
    return { content: party }
  })
  return {
    type: 'copyright',
    path,
    output: { results: entries }
  }
}
