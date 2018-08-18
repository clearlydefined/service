const { expect } = require('chai')
const utils = require('../../lib/utils')

describe('Utils latest version', () => {
  it('should get the latest version', () => {
    const inputs = {
      '1': ['1'], // https://github.com/clearlydefined/crawler/issues/124
      '1.1.0': ['1', '1.0.1', '1.1.0'], // special handling for version = '1'
      '1.2.0': ['1', '1.2.0'],
      '2.0.0': ['2.0.0'],
      '2.9.2': ['2.2.1', '2.9.2', '2.9.2'],
      '3.0.0': ['3.0.0', '1.0.1'],
      '4.0.0': ['4.0.0', '4.0.1-rc.2'],
      '5.0.0': ['5.0.0', '5.0.1-beta'],
      '6.0.0': ['6.0.0', 'undefined'],
      notarray: 'notarray',
      null: [],
      junk: ['junk', 'junk1', 'junk2']
    }

    for (const expected of Object.getOwnPropertyNames(inputs)) {
      const result = '' + utils.getLatestVersion(inputs[expected])
      expect(result).to.equal(expected)
    }
  })
})

describe('Utils mergeDefinitions', () => {
  it('should add new entries as needed', () => {
    const base = { described: { releaseDate: '2018-6-3' } }
    const newDefinition = { described: { issueTracker: 'http://bugs' }, files: [{ path: '1.txt', token: '13' }] }
    utils.mergeDefinitions(base, newDefinition)
    expect(base.described.releaseDate).to.eq('2018-6-3')
    expect(base.files.length).to.eq(1)
    expect(base.files[0].path).to.eq('1.txt')
    expect(base.files[0].token).to.eq('13')
  })

  it('should merge entries as needed', () => {
    const base = { described: { releaseDate: '2018-6-3' }, files: [{ path: '1.txt', license: 'MIT' }] }
    const newDefinition = { described: { issueTracker: 'http://bugs' }, files: [{ path: '1.txt', token: '13' }] }
    utils.mergeDefinitions(base, newDefinition)
    expect(base.described.releaseDate).to.eq('2018-6-3')
    expect(base.files.length).to.eq(1)
    expect(base.files[0].path).to.eq('1.txt')
    expect(base.files[0].token).to.eq('13')
    expect(base.files[0].license).to.eq('MIT')
  })

  it('does not mess with existing entries', () => {
    const base = {
      described: { releaseDate: '2018-6-3' },
      files: [{ path: '1.txt', license: 'MIT' }, { path: '2.txt', license: 'GPL' }]
    }
    const newDefinition = { described: { issueTracker: 'http://bugs' }, files: [{ path: '1.txt', token: '13' }] }
    utils.mergeDefinitions(base, newDefinition)
    expect(base.described.releaseDate).to.eq('2018-6-3')
    expect(base.files.length).to.eq(2)
    expect(base.files[0].path).to.eq('1.txt')
    expect(base.files[0].token).to.eq('13')
    expect(base.files[1].path).to.eq('2.txt')
    expect(base.files[1].license).to.eq('GPL')
  })
})
