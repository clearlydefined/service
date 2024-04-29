const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
chai.use(deepEqualInAnyOrder)
const expect = chai.expect
const sinon = require('sinon')
const utils = require('../../lib/utils')
const { DateTime } = require('luxon')
const EntityCoordinates = require('../../lib/entityCoordinates')

describe('Utils latest version', () => {
  it('should get the latest version', () => {
    const inputs = {
      1: ['1'], // https://github.com/clearlydefined/crawler/issues/124
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
      'https://licenses.nuget.org/Apache-2.0': 'Apache-2.0',
      'http://www.apache.org/licenses/LICENSE-2.0': 'Apache-2.0',
      'http://www.apache.org/licenses/LICENSE-2.0.html': 'Apache-2.0',
      'http://www.apache.org/licenses/LICENSE-2.0.txt': 'Apache-2.0',
      'http://www.opensource.org/licenses/mit-license.php': 'MIT',
      'https://opensource.org/licenses/MIT': 'MIT',
      'https://opensource.org/licenses/mit': 'MIT',
      'http://opensource.org/licenses/BSD-3-Clause': 'BSD-3-Clause',
      'https://licenses.nuget.org/MIT': 'MIT',
      'https://licenses.nuget.org/BSD-3-Clause': 'BSD-3-Clause',
      'https://www.gnu.org/licenses/gpl-3.0.html': 'GPL-3.0',
      'https://www.gnu.org/licenses/gPL-3.0.html': 'GPL-3.0',
      'https://www.gnu.org/licenses/gpl-2.0': 'GPL-2.0',
      'http://json.org/license.html': 'JSON',
      'http://www.json.org/license.html': 'JSON',
      'https://json.org/license.html': 'JSON',
      'https://opensource.org/licenses/JUNK': null,
      'https://www.gnu.org/licenses/JUNK': null,
      'https://github.com/owner/repo/blob/master/LICENSE': null,
      'https://raw.github.com/owner/repo/develop/LICENSE': null,
      'http://aka.ms/windowsazureapache2': null,
      'https://tldrlegal.com/license/mit-license': 'MIT',
      'https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)': 'Apache-2.0',
      'https://tldrlegal.com/license/gnu-general-public-license-v3-(gpl-3)': 'GPL-3.0',
      'https://raw.githubusercontent.com/aspnet/AspNetCore/2.0.0/LICENSE.txt': 'Apache-2.0',
      'https://raw.githubusercontent.com/aspnet/Home/2.0.0/LICENSE.txt': 'Apache-2.0',
      'https://raw.githubusercontent.com/NuGet/NuGet.Client/dev/LICENSE.txt': 'Apache-2.0',
      'https://github.com/DefinitelyTyped/NugetAutomation/blob/master/LICENSE.MIT': 'MIT',
      'http://aws.amazon.com/apache2.0/': 'Apache-2.0',
      'http://www.github.com/fsharp/Fake/blob/master/License.txt,7727': 'Apache-2.0 AND MS-PL',
      'https://github.com/MassTransit/MassTransit/blob/master/LICENSE': 'Apache-2.0',
      'http://opensource.org/licenses/ms-pl.html': 'MS-PL',
      'http://www.opensource.org/licenses/MS-pl': 'MS-PL',
      'http://www.opensource.org/licenses/ms-pl.html': 'MS-PL',
      'https://github.com/fluffynuts/PeanutButter/blob/master/LICENSE': 'BSD-3-Clause',
      'https://github.com/aspnetboilerplate/aspnetboilerplate/blob/master/LICENSE': 'MIT',
      'https://raw.githubusercontent.com/Microsoft/dotnet/master/LICENSE': 'MIT',
      'https://github.com/dotnet/corefx/blob/master/LICENSE.TXT': 'MIT',
      'https://github.com/dotnet/docfx/blob/dev/LICENSE': 'MIT',
      'https://github.com/dotnetcore/Util/blob/master/LICENSE.txt': 'MIT',
      'https://github.com/rsuter/NJsonSchema/blob/master/LICENSE.md': 'MIT',
      'https://raw.githubusercontent.com/rebus-org/Rebus/master/LICENSE.md': 'MIT',
      'http://www.gnu.org/licenses/lgpl-3.0.html': 'LGPL-3.0',
      'http://www.gnu.org/licenses/lgpl.html': 'LGPL-3.0',
      'https://www.gnu.org/licenses/lgpl.html#content': 'LGPL-3.0',
      'http://www.gnu.org/licenses/lgpl.txt': 'LGPL-3.0',
      'http://www.gnu.org/licenses/lgpl-3.0.en.html': 'LGPL-3.0',
      'http://opensource.org/licenses/EPL-1.0': 'EPL-1.0',
      'http://www.opensource.org/licenses/bsd-license.php': 'BSD-2-Clause',
      'http://www.opensource.org/licenses/gpl-3.0.html': 'GPL-3.0',
      'http://www.gnu.org/licenses/lgpl-2.1': 'LGPL-2.1',
      'http://www.gnu.org/licenses/old-licenses/gpl-2.0.html': 'GPL-2.0',
      'http://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html': 'GPL-2.0',
      // EULA licenses should be defined as OTHER
      'http://aka.ms/devservicesagreement': 'OTHER',
      'https://aka.ms/pexunj': 'OTHER',
      'https://applitools.com/eula/sdk': 'OTHER',
      'https://company.aspose.com/legal/eula': 'OTHER',
      'http://www.componentone.com/SuperPages/DevToolsEULA/': 'OTHER',
      'https://www.devexpress.com/support/eulas/': 'OTHER',
      'https://www.devexpress.com/Support/EULAs/NetComponents.xml': 'OTHER',
      'http://dlhsoft.com/LicenseAgreements/JavaScriptComponentEULA.rtf': 'OTHER',
      'http://DlhSoft.com/LicenseAgreements/ComponentEULA.rtf': 'OTHER',
      'https://www.essentialobjects.com/Products/WebBrowser/EULA.aspx': 'OTHER',
      'http://www.essentialobjects.com/Products/Pdf/EULA.aspx': 'OTHER',
      'https://www.essentialobjects.com/EULA.aspx': 'OTHER',
      'http://go.microsoft.com/fwlink/?LinkId=329770': 'OTHER',
      'https://kusto.blob.core.windows.net/kusto-nuget/EULA-agreement.htm': 'OTHER',
      'http://www.microsoft.com/web/webpi/eula/net_library_eula_enu.htm': 'OTHER',
      'http://www.microsoft.com/web/webpi/eula/aspnetwebpages_eula.rtf': 'OTHER',
      'https://www.microsoft.com/en-us/web/webpi/eula/net_library_eula_ENU.htm': 'OTHER',
      'http://www.microsoft.com/web/webpi/eula/signalr_rtw.htm': 'OTHER',
      'http://www.microsoft.com/web/webpi/eula/net_library_eula_CHS.htm': 'OTHER',
      'http://pdfium.patagames.com/faq/eula/': 'OTHER',
      'https://specflow.org/plus/eula/': 'OTHER',
      'http://www.streamcoders.com/products/msneteula.html': 'OTHER',
      'http://workflowenginenet.com/EULA': 'OTHER'
    }

    for (const licenseUrl of Object.getOwnPropertyNames(inputs)) {
      const parsedLicense = utils.extractLicenseFromLicenseUrl(licenseUrl)
      expect(parsedLicense).to.equal(inputs[licenseUrl])
    }
  })
})

describe('Utils merge Licenses', () => {
  it('should add new entries as needed', () => {
    const inputs = [
      ['MIT', null, 'MIT'],
      [null, 'MIT', 'MIT'],
      ['MIT AND GPL-3.0', 'GPL-3.0', 'GPL-3.0 AND MIT'],
      ['MIT AND GPL-3.0', 'MIT', 'GPL-3.0 AND MIT'],
      ['MIT AND GPL-3.0', 'MIT AND BSD-3-Clause', 'BSD-3-Clause AND GPL-3.0 AND MIT'],
      ['MIT OR GPL-3.0', 'GPL-3.0', 'GPL-3.0 OR (GPL-3.0 AND MIT)'],
      ['MIT OR GPL-3.0', 'MIT', 'MIT OR (GPL-3.0 AND MIT)'],
      ['MIT OR Apache-2.0', 'MIT AND Apache-2.0', 'Apache-2.0 AND MIT'],
      ['MIT AND Apache-2.0', 'MIT OR Apache-2.0', 'Apache-2.0 AND MIT']
    ]
    inputs.forEach(input => {
      const base = { licensed: { declared: input[0] } }
      utils.mergeDefinitions(base, { licensed: { declared: input[1] } })
      expect(base.licensed.declared).to.eq(input[2])
    })
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
      files: [
        { path: '1.txt', license: 'MIT' },
        { path: '2.txt', license: 'GPL' }
      ]
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

  it('overrides NOASSERTION', () => {
    const base = {
      licensed: { declared: 'NOASSERTION' },
      files: [{ path: '1.txt', license: 'NOASSERTION' }]
    }
    const newDefinition = { licensed: { declared: 'MIT' }, files: [{ path: '1.txt', license: 'GPL-3.0' }] }
    utils.mergeDefinitions(base, newDefinition)
    expect(base.licensed.declared).to.eq('MIT')
    expect(base.files.length).to.eq(1)
    expect(base.files[0].license).to.eq('GPL-3.0')
  })

  it('merges files correctly', () => {
    const base = {
      files: [
        {
          path: '1.txt',
          license: 'MIT',
          attributions: ['1', '2'],
          facets: ['core'],
          hashes: { sha1: '1', sha256: '256' },
          natures: ['license']
        }
      ]
    }
    const newDefinition = {
      files: [
        {
          path: '1.txt',
          license: 'GPL-3.0',
          attributions: ['1', '3'],
          facets: ['dev'],
          hashes: { sha1: '1', sha256: '257' },
          natures: ['test']
        }
      ]
    }
    utils.mergeDefinitions(base, newDefinition)
    const file = base.files[0]
    expect(file.attributions).to.have.members(['1', '2', '3'])
    expect(file.license).to.eq('GPL-3.0 AND MIT')
    expect(file.facets).to.have.members(['core', 'dev'])
    expect(file.hashes.sha1).to.eq('1')
    expect(file.hashes.sha256).to.eq('257')
    expect(file.natures).to.have.members(['license', 'test'])
  })

  it('merges described correctly', () => {
    const base = {
      described: {
        projectWebsite: 'https://test',
        hashes: { sha1: '1', sha256: '256' },
        facets: { dev: 'foo', core: 'bar' }
      }
    }
    const newDefinition = {
      described: {
        hashes: { sha1: '1', sha256: '257' },
        facets: { dev: 'foo', core: 'test', doc: 'this' }
      }
    }
    utils.mergeDefinitions(base, newDefinition)
    expect(base.described.projectWebsite).to.eq('https://test')
    expect(base.described.hashes.sha1).to.eq('1')
    expect(base.described.hashes.sha256).to.eq('257')
    expect(base.described.facets.dev).to.eq('foo')
    expect(base.described.facets.core).to.eq('test')
    expect(base.described.facets.doc).to.eq('this')
  })
})

describe('Copyright simplification', () => {
  it('handles duplicate entries', () => {
    const result = utils.simplifyAttributions(['foo', 'foo', 'bar'])
    expect(result).to.equalInAnyOrder(['foo', 'bar'])
  })

  it('handles bogus punctuation', () => {
    const result = utils.simplifyAttributions(['%$#@foo*&^$', 'foo$.', 'foo.', 'foo.*&$!', 'bar,'])
    expect(result).to.equalInAnyOrder(['foo.', 'foo$.', 'bar'])
  })

  it('decodes html, removes redundant white space', () => {
    const result = utils.simplifyAttributions(['&lt;jane@foo.com&gt;', ' \r \nfoo   bar  \\n\r', 'foo bar'])
    expect(result).to.equalInAnyOrder(['<jane@foo.com>', 'foo bar'])
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
      'COPYING',
      'copying',
      'copying.txt',
      'COPYING.md',
      'copying.html'
    ]

    for (const input of inputs) {
      expect(utils.isLicenseFile(input), `input: ${input}`).to.be.true
    }
  })

  it('should not detect nested license files without coordinates', () => {
    const inputs = ['package/LICENSE', 'licenses/license', 'package/COPYING', 'licenses/copying']

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
      'package/COPYING',
      'package/copying',
      'package/Copying.txt',
      'package/COPYING.md',
      'package/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('npm/npm/-/name/version')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.true
    }
  })

  it('should detect package level license files for mavens', () => {
    const inputs = [
      'meta-inf/LICENSE',
      'meta-inf/license',
      'meta-inf/License.txt',
      'meta-inf/LICENSE.md',
      'meta-inf/LICENSE.HTML',
      'meta-inf/COPYING',
      'meta-inf/copying',
      'meta-inf/Copying.txt',
      'meta-inf/COPYING.md',
      'meta-inf/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('maven/mavencentral/group/artifact/version')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.true
    }
  })

  it('should detect package level license files for sourcearchive', () => {
    const inputs = [
      'meta-inf/LICENSE',
      'meta-inf/license',
      'meta-inf/License.txt',
      'meta-inf/LICENSE.md',
      'meta-inf/LICENSE.HTML',
      'meta-inf/COPYING',
      'meta-inf/copying',
      'meta-inf/Copying.txt',
      'meta-inf/COPYING.md',
      'meta-inf/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('sourcearchive/mavencentral/group/artifact/version')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.true
    }
  })

  it('should detect package level license files for pythons', () => {
    const inputs = [
      'redis-3.1/LICENSE',
      'redis-3.1/license',
      'redis-3.1/License.txt',
      'redis-3.1/LICENSE.md',
      'redis-3.1/LICENSE.HTML',
      'redis-3.1/COPYING',
      'redis-3.1/copying',
      'redis-3.1/Copying.txt',
      'redis-3.1/COPYING.md',
      'redis-3.1/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('pypi/pypi/-/redis/3.1')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.true
    }
  })

  it('should detect package level license files for debsrc', () => {
    const inputs = [
      'tenacity-8.2.1/LICENSE',
      'tenacity-8.2.1/license',
      'tenacity-8.2.1/License.txt',
      'tenacity-8.2.1/LICENSE.md',
      'tenacity-8.2.1/LICENSE.HTML',
      'tenacity-8.2.1/COPYING',
      'tenacity-8.2.1/copying',
      'tenacity-8.2.1/Copying.txt',
      'tenacity-8.2.1/COPYING.md',
      'tenacity-8.2.1/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('debsrc/debian/-/python-tenacity/8.2.1-1')
    const packages = [
      { name: 'python-tenacity-doc' },
      { name: 'python3-tenacity' },
      { name: 'tenacity', version: '8.2.1' }
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate, packages), `input: ${input}`).to.be.true
    }
  })

  it('should not detect package level license files for NuGets', () => {
    const inputs = [
      'package/LICENSE',
      'package/license',
      'package/License.txt',
      'package/LICENSE.md',
      'package/LICENSE.HTML',
      'package/COPYING',
      'package/copying',
      'package/Copying.txt',
      'package/COPYING.md',
      'package/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('nuget/nuget/-/redis/3.1')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.false
    }
  })

  it('should not detect random folder license files for npms', () => {
    const inputs = [
      'foobar/LICENSE',
      'package/deeper/license',
      'deeper/package/License.txt',
      '.package/LICENSE.md',
      'package2/LICENSE.HTML',
      'foobar/COPYING',
      'package/deeper/copying',
      'deeper/package/Copying.txt',
      '.package/COPYING.md',
      'package2/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('npm/npm/-/name/version')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.false
    }
  })

  it('should not detect random folder license files for mavens', () => {
    const inputs = [
      'foobar/LICENSE',
      'package/deeper/license',
      'deeper/package/License.txt',
      '.package/LICENSE.md',
      'package2/LICENSE.HTML',
      'foobar/COPYING',
      'package/deeper/copying',
      'deeper/package/Copying.txt',
      '.package/COPYING.md',
      'package2/COPYING.HTML'
    ]
    const coordinate = EntityCoordinates.fromString('maven/mavencentral/group/artifact/version')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.false
    }
  })

  it('should not detect other license files for pythons', () => {
    const inputs = [
      'special/LICENSE',
      'redis-3.1/nested/LICENSE',
      'redis-3.2/LICENSE',
      'other-3.1/LICENSE',
      'package/LICENSE',
      'special/COPYING',
      'redis-3.1/nested/COPYING',
      'redis-3.2/COPYING',
      'other-3.1/COPYING',
      'package/COPYING'
    ]
    const coordinate = EntityCoordinates.fromString('pypi/pypi/-/redis/3.1')
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate), `input: ${input}`).to.be.false
    }
  })

  it('should not detect package level or random license files for debsrc', () => {
    const inputs = [
      'foobar/LICENSE',
      'package/deeper/license',
      'deeper/package/License.txt',
      '.package/LICENSE.md',
      'package2/LICENSE.HTML',
      'foobar/COPYING',
      'package/deeper/copying',
      'deeper/package/Copying.txt',
      '.package/COPYING.md',
      'package2/COPYING.HTML',
      'special/LICENSE',
      'tenacity-8.2.1/nested/LICENSE',
      'tenacity-8.2.2/LICENSE',
      'other-8.2.1/LICENSE',
      'package/LICENSE',
      'special/COPYING',
      'tenacity-8.2.1/nested/COPYING',
      'tenacity-8.2.2/COPYING',
      'other-8.2.1/COPYING',
      'package/COPYING'
    ]
    const coordinate = EntityCoordinates.fromString('debsrc/debian/-/python-tenacity/8.2.1-1')
    const packages = [
      { name: 'python-tenacity-doc' },
      { name: 'python3-tenacity' },
      { name: 'tenacity', version: '8.2.1' }
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, coordinate, packages), `input: ${input}`).to.be.false
    }
  })

  it('should handle falsy input', () => {
    expect(utils.isLicenseFile()).to.be.false
  })
})

describe('Utils extractDate', () => {
  it('should extract date from timestamps', () => {
    const inputs = {
      '2014-11-21T00:06:54.027559+00:00': '2014-11-21',
      '2014-11-21': '2014-11-21',
      '11-21-2014': '2014-11-21',
      '21-garbage': null,
      '21-11-2014': null,
      '22-garbage': null,
      '1900-01-01:T00:00:00': null,
      '9999-01-01:T00:00:00': null,
      '1900-01-01': null,
      '9999-01-01': null,
      '2018-05-28 07:26:25 UTC': '2018-05-28'
    }
    const nowIso = DateTime.utc().toISODate()
    inputs[nowIso] = nowIso
    const nowPlus20DaysIso = DateTime.utc().plus({ days: 20 }).toISODate()
    inputs[nowPlus20DaysIso] = nowPlus20DaysIso
    const nowPlus31DaysIso = DateTime.utc().plus({ days: 31 }).toISODate()
    inputs[nowPlus31DaysIso] = null

    for (const timestamp of Object.getOwnPropertyNames(inputs)) {
      const date = utils.extractDate(timestamp)
      expect(date).to.equal(inputs[timestamp])
    }
  })
})

describe('Utils compareDates', () => {
  it('sort non null dates', () => {
    const sorted = ['2010-01-01', '1990-01-01', '2000-01-01'].sort(utils.compareDates)
    expect(sorted).to.deep.eq(['1990-01-01', '2000-01-01', '2010-01-01'])
  })

  it('reverse sort non null dates', () => {
    const sorted = ['2010-01-01', '1990-01-01', '2000-01-01'].sort((x, y) => -utils.compareDates(x, y))
    expect(sorted).to.deep.eq(['2010-01-01', '2000-01-01', '1990-01-01'])
  })

  it('sort null and non null dates: null first', () => {
    const sorted = [null, '1990-01-01', null].sort(utils.compareDates)
    expect(sorted).to.deep.eq([null, null, '1990-01-01'])
  })

  it('reverse sort null and non null: null last', () => {
    const sorted = [null, '1990-01-01', null].sort((x, y) => -utils.compareDates(x, y))
    expect(sorted).to.deep.eq(['1990-01-01', null, null])
  })
})

describe('Utils toEntityCoordinatesFromRequest', () => {
  const fakeRequest = {
    params: {
      type: 'pypi',
      provider: 'pypi',
      namespace: '-',
      name: 'javaproperties',
      revision: '0.8.1'
    }
  }

  before(function () {
    sinon.replace(utils, 'toNormalizedEntityCoordinates', entry => Promise.resolve(entry))
  })

  after(function () {
    sinon.restore()
  })

  it('should turn a request into entity coordinates', async () => {
    const result = await utils.toEntityCoordinatesFromRequest(fakeRequest)
    expect(result.type).to.eq('pypi')
    expect(result.provider).to.eq('pypi')
    expect(result.namespace).to.eq(undefined)
    expect(result.name).to.eq('javaproperties')
    expect(result.revision).to.eq('0.8.1')
  })

  const fakeSlashNamespaceRequest = {
    params: {
      type: 'go',
      provider: 'golang',
      namespace: 'rsc.io/quote',
      name: 'v3',
      revision: 'v3.1.0'
    }
  }

  it('encodes slashes in namespaces', async () => {
    const result = await utils.toEntityCoordinatesFromRequest(fakeSlashNamespaceRequest)
    expect(result.namespace).to.eq('rsc.io%2fquote')
  })
})

describe('Utils toEntityCoordinatesFromArgs', () => {
  const args = {
    type: 'go',
    provider: 'golang',
    namespace: 'rsc.io/quote',
    name: 'v3',
    revision: 'v3.1.0'
  }

  it('should turn the args into entity coordinates', () => {
    const result = utils.toEntityCoordinatesFromArgs(args)
    expect(result.type).to.eq('go')
    expect(result.provider).to.eq('golang')
    expect(result.namespace).to.eq('rsc.io%2fquote')
    expect(result.name).to.eq('v3')
    expect(result.revision).to.eq('v3.1.0')
  })
})

describe('Utils parseNamespaceNameRevision', () => {
  const fakeSlashNamespaceRequest = {
    params: {
      type: 'go',
      provider: 'golang',
      namespace: 'rsc.io/quote',
      name: 'v3',
      revision: 'foo',
      extra1: 'bar',
      extra2: 'bah',
      extra3: 'v3.1.0'
    }
  }

  it('parses the args into one string', () => {
    const result = utils.parseNamespaceNameRevision(fakeSlashNamespaceRequest)
    expect(result).to.eq('rsc.io/quote/v3/foo/bar/bah/v3.1.0')
  })
})

describe('Utils getLicenseLocations', () => {
  const npmRequest = {
    params: {
      type: 'npm',
      provider: 'npmjs',
      namespace: '-',
      name: 'javascriptproperties',
      revision: '0.8.1'
    }
  }

  before(function () {
    sinon.replace(utils, 'toNormalizedEntityCoordinates', entry => Promise.resolve(entry))
  })

  after(function () {
    sinon.restore()
  })

  it('finds the correct license location for npm packages', async () => {
    const coordinates = await utils.toEntityCoordinatesFromRequest(npmRequest)
    const result = utils.getLicenseLocations(coordinates)
    expect(result).to.deep.include('package/')
  })

  describe('Go packages', () => {
    const goRequest = {
      params: {
        type: 'go',
        provider: 'golang',
        namespace: 'go.uber.org',
        name: 'fx',
        revision: '1.14.2'
      }
    }

    it('finds the correct location for go packages', async () => {
      const coordinates = await utils.toEntityCoordinatesFromRequest(goRequest)
      const result = utils.getLicenseLocations(coordinates)
      expect(result).to.deep.include('go.uber.org/fx@1.14.2/')
    })

    it('finds the correct license location for complex namespaces with lower case %2f', async () => {
      const complexNamespaceRequest = {
        params: {
          type: 'go',
          provider: 'golang',
          namespace: 'github.com%2fconcourse',
          name: 'github-release-resource',
          revision: 'v1.6.4'
        }
      }

      const coordinates = await utils.toEntityCoordinatesFromRequest(complexNamespaceRequest)
      const result = utils.getLicenseLocations(coordinates)
      expect(result).to.deep.include('github.com/concourse/github-release-resource@v1.6.4/')
    })

    it('finds the correct license location for complex namespaces with upper case %2F', async () => {
      const complexNamespaceRequest = {
        params: {
          type: 'go',
          provider: 'golang',
          namespace: 'github.com%2Fconcourse',
          name: 'github-release-resource',
          revision: 'v1.6.4'
        }
      }

      const coordinates = await utils.toEntityCoordinatesFromRequest(complexNamespaceRequest)
      const result = utils.getLicenseLocations(coordinates)
      expect(result).to.deep.include('github.com/concourse/github-release-resource@v1.6.4/')
    })
  })

  describe('debsrc packages', () => {
    const debsrcRequest = {
      params: {
        type: 'debsrc',
        provider: 'debian',
        namespace: '-',
        name: 'python-tenacity',
        revision: '8.2.1-1'
      }
    }

    it('returns an empty array when not passing packages', async () => {
      const coordinates = await utils.toEntityCoordinatesFromRequest(debsrcRequest)
      const result = utils.getLicenseLocations(coordinates)
      expect(result).to.deep.equal([])
    })

    it('finds the correct license locations when passing packages', async () => {
      const coordinates = await utils.toEntityCoordinatesFromRequest(debsrcRequest)
      const packages = [
        { name: 'python-tenacity-doc' },
        { name: 'python3-tenacity' },
        { name: 'tenacity', version: '8.2.1' }
      ]
      const result = utils.getLicenseLocations(coordinates, packages)
      expect(result).to.deep.equal(['python-tenacity-doc/', 'python3-tenacity/', 'tenacity-8.2.1/'])
    })
  })
})

describe('Utils buildSourceUrl', () => {
  it('returns the correct github source url', () => {
    const args = {
      type: 'git',
      provider: 'github',
      namespace: 'clearlydefined',
      name: 'service',
      revision: '123abc'
    }

    const coordinates = utils.toEntityCoordinatesFromArgs(args)
    const result = utils.buildSourceUrl(coordinates)

    expect(result).to.eq('https://github.com/clearlydefined/service/tree/123abc')
  })

  it('returns the correct gitlab source url', () => {
    const args = {
      type: 'git',
      provider: 'gitlab',
      namespace: 'clearlydefined',
      name: 'service',
      revision: '123abc'
    }

    const coordinates = utils.toEntityCoordinatesFromArgs(args)
    const result = utils.buildSourceUrl(coordinates)

    expect(result).to.eq('https://gitlab.com/clearlydefined/service/-/tree/123abc')
  })

  describe('maven urls', () => {
    it('returns the correct mavencentral source url', () => {
      const args = {
        type: 'maven',
        provider: 'mavencentral',
        namespace: 'clearlydefined',
        name: 'service',
        revision: '1.2.3'
      }

      const coordinates = utils.toEntityCoordinatesFromArgs(args)
      const result = utils.buildSourceUrl(coordinates)

      expect(result).to.eq(
        'https://search.maven.org/remotecontent?filepath=clearlydefined/service/1.2.3/service-1.2.3-sources.jar'
      )
    })

    it('returns the correct mavencentral source url with dots in the namespace', () => {
      const args = {
        type: 'maven',
        provider: 'mavencentral',
        namespace: 'clearlydefined.foo',
        name: 'service',
        revision: '1.2.3'
      }

      const coordinates = utils.toEntityCoordinatesFromArgs(args)
      const result = utils.buildSourceUrl(coordinates)

      expect(result).to.eq(
        'https://search.maven.org/remotecontent?filepath=clearlydefined/foo/service/1.2.3/service-1.2.3-sources.jar'
      )
    })

    it('returns the correct mavengoogle source url', () => {
      const args = {
        type: 'maven',
        provider: 'mavengoogle',
        namespace: 'clearlydefined',
        name: 'service',
        revision: '1.2.3'
      }

      const coordinates = utils.toEntityCoordinatesFromArgs(args)
      const result = utils.buildSourceUrl(coordinates)

      expect(result).to.eq('https://maven.google.com/web/index.html#clearlydefined:service:1.2.3')
    })
  })

  describe('go urls', () => {
    it('returns the correct golang source url', () => {
      const args = {
        type: 'go',
        provider: 'golang',
        namespace: 'clearlydefined',
        name: 'service',
        revision: 'v1.2.3'
      }

      const coordinates = utils.toEntityCoordinatesFromArgs(args)
      const result = utils.buildSourceUrl(coordinates)

      expect(result).to.eq('https://pkg.go.dev/clearlydefined/service@v1.2.3')
    })

    it('returns the correct golang source url with slashes in the namespace', () => {
      const args = {
        type: 'go',
        provider: 'golang',
        namespace: 'clearlydefined%2ffoo',
        name: 'service',
        revision: 'v1.2.3'
      }

      const coordinates = utils.toEntityCoordinatesFromArgs(args)
      const result = utils.buildSourceUrl(coordinates)

      expect(result).to.eq('https://pkg.go.dev/clearlydefined/foo/service@v1.2.3')
    })
  })

  it('returns the correct pypi source url', () => {
    const args = {
      type: 'pypi',
      provider: 'pypi',
      namespace: '-',
      name: 'zuul',
      revision: '3.3.0'
    }

    const coordinates = utils.toEntityCoordinatesFromArgs(args)
    const result = utils.buildSourceUrl(coordinates)

    expect(result).to.eq('https://pypi.org/project/zuul/3.3.0/')
  })
})
