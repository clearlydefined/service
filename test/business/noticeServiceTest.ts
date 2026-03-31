import assert from 'node:assert/strict'
import { describe, it, before, mock } from 'node:test'
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import spdxLicenseList from 'spdx-license-list/full.js'
import NoticeService from '../../business/noticeService.js'
import logger from '../../providers/logging/logger.js'
import { createSilentLogger } from '../helpers/mockLogger.ts'

describe('Notice Service', () => {
  before(() => {
    logger(createSilentLogger())
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
    assert.strictEqual(normalizeLineBreaks(notice.content),
      normalizeLineBreaks(
        `** test; version 1.0.0 -- \ncopyright me\n\n${(spdxLicenseList as unknown as Record<string, Record<string, string>>).MIT.licenseText}`
      )
    )
    assert.deepStrictEqual(notice.summary, {
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
    assert.strictEqual(normalizeLineBreaks(notice.content),
      normalizeLineBreaks(
        `** @scope/test; version 1.0.0 -- \n\n${(spdxLicenseList as unknown as Record<string, Record<string, string>>).MIT.licenseText}`
      )
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
    assert.strictEqual(notice.content, '** test; version 1.0.0 -- \n\n%%%This is the attachment%%%')
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
    assert.strictEqual(notice.content, 
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
    assert.strictEqual(notice.content, 
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
    assert.strictEqual(normalizeLineBreaks(notice.content),
      normalizeLineBreaks(
        `** no-copyright; version 1.0.0 -- \n\n${(spdxLicenseList as unknown as Record<string, Record<string, string>>).MIT.licenseText}`
      )
    )
    assert.deepStrictEqual(notice.summary, {
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
    assert.strictEqual(notice.content, '')
    assert.deepStrictEqual(notice.summary, {
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
    assert.strictEqual(notice.content, '')
    assert.deepStrictEqual(notice.summary, {
      total: 0,
      warnings: { noCopyright: [], noDefinition: [], noLicense: [] }
    })
  })

  it('gets renderer by choice', () => {
    const { service } = setup({})
    assert.strictEqual(service._getRenderer().constructor.name, 'TextRenderer')
    assert.strictEqual(service._getRenderer('text').constructor.name, 'TextRenderer')
    assert.strictEqual(service._getRenderer('html', {}).constructor.name, 'HtmlRenderer')
    assert.strictEqual(service._getRenderer('template', { template: 'template' }).constructor.name, 'TemplateRenderer')
    assert.strictEqual(service._getRenderer('json').constructor.name, 'JsonRenderer')

    try {
      service._getRenderer('junk')
      assert.strictEqual(true, false)
    } catch (error) {
      assert.strictEqual((error as Error).message, '"junk" is not a supported renderer')
    }

    try {
      service._getRenderer('template', {})
      assert.strictEqual(true, false)
    } catch (error) {
      assert.strictEqual((error as Error).message, 'options.template is required for template renderer')
    }
  })
})

function setup(definitions: Record<string, Record<string, unknown>>, attachments: Record<string, string> = {}) {
  const attachmentStore = { get: (token: string) => attachments[token] }
  const definitionService = { getAll: mock.fn(() => Promise.resolve(definitions)) }
  const service: Record<string, (...args: any[]) => any> = (NoticeService as (...args: any[]) => any)(
    definitionService,
    attachmentStore
  )
  const coordinates = Object.keys(definitions).map(x => definitions[x].coordinates)
  return { service, coordinates }
}

function normalizeLineBreaks(str: string): string {
  const normalized = str.replace(/[\r\n]+/g, ' ').trim()
  return normalized.replace(/\s+/g, ' ')
}
