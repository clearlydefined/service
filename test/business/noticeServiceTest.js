// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const NoticeService = require('../../business/noticeService')
const spdxLicenseList = require('spdx-license-list/full')
const logger = require('../../providers/logging/logger')

const mockLogger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

describe('Notice Service', () => {
  before(() => {
    logger(mockLogger)
  })

  it('generates simple notice', async () => {
    const { service, coordinates } = setup({
      'npm/npmjs/-/test/1.0.0': {
        coordinates: { name: 'test', revision: '1.0.0' },
        licensed: { declared: 'MIT', facets: { core: { attribution: { parties: ['copyright me'] } } } },
        described: { tools: ['clearlydefined/1.0.0'] }
      }
    })
    const notice = await service.generate(coordinates)
    expect(normalizeLineBreaks(notice.content)).to.eq(
      normalizeLineBreaks('** test; version 1.0.0 -- \ncopyright me\n\n' + spdxLicenseList.MIT.licenseText)
    )
    expect(notice.summary).to.deep.eq({
      total: 1,
      warnings: { noCopyright: [], noDefinition: [], noLicense: [] }
    })
  })

  it('generates notices with namespace', async () => {
    const { service, coordinates } = setup({
      'npm/npmjs/-/test/1.0.0': {
        coordinates: { namespace: '@scope', name: 'test', revision: '1.0.0' },
        licensed: { declared: 'MIT' },
        described: { tools: ['clearlydefined/1.0.0'] }
      }
    })
    const notice = await service.generate(coordinates)
    expect(normalizeLineBreaks(notice.content)).to.eq(
      normalizeLineBreaks('** @scope/test; version 1.0.0 -- \n\n' + spdxLicenseList.MIT.licenseText)
    )
  })

  it('includes license for package', async () => {
    const { service, coordinates } = setup(
      {
        'npm/npmjs/-/test/1.0.0': {
          coordinates: { name: 'test', revision: '1.0.0' },
          licensed: { declared: 'MIT' },
          files: [{ path: 'LICENSE', token: 'abcd', natures: ['license'] }],
          described: { tools: ['clearlydefined/1.0.0'] }
        }
      },
      { abcd: '%%%This is the attachment%%%' }
    )
    const notice = await service.generate(coordinates)
    expect(notice.content).to.eq('** test; version 1.0.0 -- \n\n%%%This is the attachment%%%')
  })

  it('includes license only for top-level files in a package', async () => {
    const { service, coordinates } = setup(
      {
        'npm/npmjs/-/tested/1.0.0': {
          coordinates: { name: 'tested', revision: '1.0.0' },
          licensed: { declared: 'MIT' },
          files: [{ path: 'LICENSE', token: 'abcd', natures: ['license'] }],
          described: { tools: ['clearlydefined/1.0.0'] }
        },
        'npm/npmjs/-/tested/2.0.0': {
          coordinates: { name: 'tested', revision: '2.0.0' },
          licensed: { declared: 'MIT' },
          files: [
            { path: 'some/other/LICENSE', token: 'efgh', natures: ['license'] },
            { path: 'LICENSE', token: 'ijkl', natures: ['license'] }
          ],
          described: { tools: ['clearlydefined/1.0.0'] }
        }
      },
      {
        abcd: '%%%This is the attachment%%%',
        efgh: '%%%This should not be included!%%%',
        ijkl: '%%%This should be included!%%%'
      }
    )
    const notice = await service.generate(coordinates)
    expect(notice.content).to.eq(
      '** tested; version 2.0.0 -- \n\n%%%This should be included!%%%\n\n------\n\n** tested; version 1.0.0 -- \n\n%%%This is the attachment%%%'
    )
  })

  it('renders with custom template', async () => {
    const { service, coordinates } = setup({
      'npm/npmjs/-/test/1.0.0': {
        coordinates: { name: 'test', revision: '1.0.0' },
        licensed: { declared: 'MIT' },
        described: { tools: ['clearlydefined/1.0.0'] }
      },
      'npm/npmjs/-/test/2.0.0': {
        coordinates: { name: 'test', revision: '2.0.0' },
        licensed: { declared: 'Apache-2.0' },
        described: { tools: ['clearlydefined/1.0.0'] }
      }
    })
    const notice = await service.generate(coordinates, 'template', {
      template:
        'HEADER CONTENT\n\n\n----\n\n{{#buckets}}\n{{#packages}}\n\n----\n\n{{{name}}} {{{version}}} - {{{../name}}}\n{{/packages}}{{/buckets}}\n'
    })
    expect(notice.content).to.eq(
      'HEADER CONTENT\n\n\n----\n\n\n----\n\ntest 2.0.0 - Apache-2.0\n\n----\n\ntest 1.0.0 - MIT\n\n'
    )
  })

  it('buckets warnings', async () => {
    const { service, coordinates } = setup({
      'npm/npmjs/-/not-harvested/1.0.0': {
        coordinates: { name: 'not-harvested', revision: '1.0.0' }
      },
      'npm/npmjs/-/no-license/1.0.0': {
        coordinates: { name: 'no-license', revision: '1.0.0' },
        licensed: { facets: { core: { attribution: { parties: ['copyright me'] } } } },
        described: { tools: ['clearlydefined/1.0.0'] }
      },
      'npm/npmjs/-/no-copyright/1.0.0': {
        coordinates: { name: 'no-copyright', revision: '1.0.0' },
        licensed: { declared: 'MIT' },
        described: { tools: ['clearlydefined/1.0.0'] }
      }
    })
    const notice = await service.generate(coordinates)
    expect(normalizeLineBreaks(notice.content)).to.eq(
      normalizeLineBreaks('** no-copyright; version 1.0.0 -- \n\n' + spdxLicenseList.MIT.licenseText)
    )
    expect(notice.summary).to.deep.eq({
      total: 3,
      warnings: {
        noDefinition: ['npm/npmjs/-/not-harvested/1.0.0'],
        noLicense: ['npm/npmjs/-/no-license/1.0.0'],
        noCopyright: ['npm/npmjs/-/no-copyright/1.0.0']
      }
    })
  })

  it('handles NOASSERTION and NONE licenses', async () => {
    const { service, coordinates } = setup({
      'npm/npmjs/-/no-assertion/1.0.0': {
        coordinates: { name: 'no-assertion', revision: '1.0.0' },
        licensed: { declared: 'NOASSERTION', facets: { core: { attribution: { parties: ['copyright me'] } } } },
        described: { tools: ['clearlydefined/1.0.0'] }
      },
      'npm/npmjs/-/none/1.0.0': {
        coordinates: { name: 'none', revision: '1.0.0' },
        licensed: { declared: 'NONE', facets: { core: { attribution: { parties: ['copyright me'] } } } },
        described: { tools: ['clearlydefined/1.0.0'] }
      }
    })
    const notice = await service.generate(coordinates)
    expect(notice.content).to.eq('')
    expect(notice.summary).to.deep.eq({
      total: 2,
      warnings: {
        noCopyright: [],
        noDefinition: [],
        noLicense: ['npm/npmjs/-/no-assertion/1.0.0', 'npm/npmjs/-/none/1.0.0']
      }
    })
  })

  it('generates empty notices for no definitions', async () => {
    const { service, coordinates } = setup({})
    const notice = await service.generate(coordinates)
    expect(notice.content).to.eq('')
    expect(notice.summary).to.deep.eq({
      total: 0,
      warnings: { noCopyright: [], noDefinition: [], noLicense: [] }
    })
  })

  it('gets renderer by choice', () => {
    const { service } = setup({})
    expect(service._getRenderer().constructor.name).to.eq('TextRenderer')
    expect(service._getRenderer('text').constructor.name).to.eq('TextRenderer')
    expect(service._getRenderer('html', {}).constructor.name).to.eq('HtmlRenderer')
    expect(service._getRenderer('template', { template: 'template' }).constructor.name).to.eq('TemplateRenderer')
    expect(service._getRenderer('json').constructor.name).to.eq('JsonRenderer')

    try {
      service._getRenderer('junk')
      expect(true).to.be.false
    } catch (error) {
      expect(error.message).to.eq('"junk" is not a supported renderer')
    }

    try {
      service._getRenderer('template', {})
      expect(true).to.be.false
    } catch (error) {
      expect(error.message).to.eq('options.template is required for template renderer')
    }
  })
})

function setup(definitions, attachments = {}) {
  const attachmentStore = { get: token => attachments[token] }
  const definitionService = { getAll: sinon.stub().returns(Promise.resolve(definitions)) }
  const service = NoticeService(definitionService, attachmentStore)
  const coordinates = Object.keys(definitions).map(x => definitions[x].coordinates)
  return { service, coordinates }
}

function normalizeLineBreaks(str) {
  const normalized = str.replace(/[\r\n]+/g, ' ').trim()
  return normalized.replace(/\s+/g, ' ')
}
