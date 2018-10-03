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

  it('should extract license from license URLs', () => {
    const inputs = {
      'http://opensource.org/licenses/Apache-2.0': 'Apache-2.0',
      'http://www.apache.org/licenses/LICENSE-2.0': 'Apache-2.0',
      'http://www.apache.org/licenses/LICENSE-2.0.html': 'Apache-2.0',
      'http://www.opensource.org/licenses/mit-license.php': 'MIT',
      'https://opensource.org/licenses/MIT': 'MIT',
      'https://opensource.org/licenses/mit': 'MIT',
      'https://www.gnu.org/licenses/gpl-3.0.html': 'GPL-3.0',
      'https://www.gnu.org/licenses/gPL-3.0.html': 'GPL-3.0',
      'https://www.gnu.org/licenses/gpl-2.0': 'GPL-2.0',
      'https://opensource.org/licenses/JUNK': undefined,
      'https://www.gnu.org/licenses/JUNK': undefined,
      'https://github.com/owner/repo/blob/master/LICENSE': undefined,
      'https://raw.github.com/owner/repo/develop/LICENSE': undefined,
      'http://aka.ms/windowsazureapache2': undefined
    }

    for (const licenseUrl of Object.getOwnPropertyNames(inputs)) {
      const parsedLicense = utils.extractLicenseFromLicenseUrl(licenseUrl)
      expect(parsedLicense).to.equal(inputs[licenseUrl])
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
    expect(base.files[0].license).to.eq('MIT')
    expect(base.files[1].path).to.eq('2.txt')
    expect(base.files[1].license).to.eq('GPL')
  })
})

describe('Utils isLicenseFile', () => {
  it('should detect root level license files', () => {
    const inputs = [
      'LICENSE',
      'license',
      'License.txt',
      'LICENSE.md',
      'LICENSE.HTML',
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input), `input: ${input}`).to.be.true
    }
  })

  it('should not detect nested license files without coordinates', () => {
    const inputs = [
      'package/LICENSE',
      'licenses/license',
    ]

    for (const input of inputs) {
      expect(utils.isLicenseFile(input), `input: ${input}`).to.be.false
    }
  })

  it('should detect package level license files for npms', () => {
    const inputs = [
      'package/LICENSE',
      'package/license',
      'package/License.txt',
      'package/LICENSE.md',
      'package/LICENSE.HTML',
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'npm' }), `input: ${input}`).to.be.true
    }
  })

  it('should not detect package level license files for NuGets', () => {
    const inputs = [
      'package/LICENSE',
      'package/license',
      'package/License.txt',
      'package/LICENSE.md',
      'package/LICENSE.HTML',
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'nuget' }), `input: ${input}`).to.be.false
    }
  })

  it('should not detect random folder license files for npms', () => {
    const inputs = [
      'foobar/LICENSE',
      'package/deeper/license',
      'deeper/package/License.txt',
      '.package/LICENSE.md',
      'package2/LICENSE.HTML',
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'npm' }), `input: ${input}`).to.be.false
    }
  })

  it('should handle falsy input', () => {
    expect(utils.isLicenseFile()).to.be.false
  })
})
