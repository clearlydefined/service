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
      'https://github.com/dotnet/docfx/blob/dev/LICENSE,1505': 'MIT',
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
      'https://aka.ms/netcoregaeula': 'OTHER',
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
    const inputs = ['LICENSE', 'license', 'License.txt', 'LICENSE.md', 'LICENSE.HTML']
    for (const input of inputs) {
      expect(utils.isLicenseFile(input), `input: ${input}`).to.be.true
    }
  })

  it('should not detect nested license files without coordinates', () => {
    const inputs = ['package/LICENSE', 'licenses/license']

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
      'package/LICENSE.HTML'
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'npm' }), `input: ${input}`).to.be.true
    }
  })

  it('should detect package level license files for mavens', () => {
    const inputs = [
      'meta-inf/LICENSE',
      'meta-inf/license',
      'meta-inf/License.txt',
      'meta-inf/LICENSE.md',
      'meta-inf/LICENSE.HTML'
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'maven' }), `input: ${input}`).to.be.true
    }
  })

  it('should detect package level license files for pythons', () => {
    const inputs = [
      'redis-3.1/LICENSE',
      'redis-3.1/license',
      'redis-3.1/License.txt',
      'redis-3.1/LICENSE.md',
      'redis-3.1/LICENSE.HTML'
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'pypi', name: 'redis', revision: '3.1' }), `input: ${input}`).to.be.true
    }
  })

  it('should not detect package level license files for NuGets', () => {
    const inputs = [
      'package/LICENSE',
      'package/license',
      'package/License.txt',
      'package/LICENSE.md',
      'package/LICENSE.HTML'
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
      'package2/LICENSE.HTML'
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'npm' }), `input: ${input}`).to.be.false
    }
  })

  it('should not detect random folder license files for mavens', () => {
    const inputs = [
      'foobar/LICENSE',
      'package/deeper/license',
      'deeper/package/License.txt',
      '.package/LICENSE.md',
      'package2/LICENSE.HTML'
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'maven' }), `input: ${input}`).to.be.false
    }
  })

  it('should not detect other license files for pythons', () => {
    const inputs = [
      'special/LICENSE',
      'redis-3.1/nested/LICENSE',
      'redis-3.2/LICENSE',
      'other-3.1/LICENSE',
      'package/LICENSE'
    ]
    for (const input of inputs) {
      expect(utils.isLicenseFile(input, { type: 'pypi', name: 'redis', revision: '3.1' }), `input: ${input}`).to.be
        .false
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
      '21-11-2014': null,
      '21-garbage': null,
      '1900-01-01:T00:00:00': null,
      '9999-01-01:T00:00:00': null,
      '1900-01-01': null,
      '9999-01-01': null
    }

    for (const timestamp of Object.getOwnPropertyNames(inputs)) {
      const date = utils.extractDate(timestamp)
      expect(date).to.equal(inputs[timestamp])
    }
  })
})
