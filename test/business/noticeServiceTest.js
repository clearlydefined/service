// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const NoticeService = require('../../business/noticeService')
const spdxLicenseList = require('spdx-license-list/full')

describe('Notice Service', () => {
  it('generates simple notice', async () => {
    const { service } = setup({
      'npm/npmjs/-/test/1.0.0': {
        coordinates: { name: 'test', revision: '1.0.0' },
        licensed: { declared: 'MIT' }
      }
    })
    const notice = await service.generate()
    expect(notice).to.eq('** test; version 1.0.0 -- \n\n' + spdxLicenseList.MIT.licenseText)
  })

  it('generates notices with namespace', async () => {
    const { service } = setup({
      'npm/npmjs/-/test/1.0.0': {
        coordinates: { namespace: '@scope', name: 'test', revision: '1.0.0' },
        licensed: { declared: 'MIT' }
      }
    })
    const notice = await service.generate()
    expect(notice).to.eq('** @scope/test; version 1.0.0 -- \n\n' + spdxLicenseList.MIT.licenseText)
  })

  it('includes license for package', async () => {
    const { service } = setup(
      {
        'npm/npmjs/-/test/1.0.0': {
          coordinates: { name: 'test', revision: '1.0.0' },
          licensed: { declared: 'MIT' },
          files: [{ path: 'LICENSE', token: 'abcd', natures: ['license'] }]
        }
      },
      { abcd: '%%%This is the attachment%%%' }
    )
    const notice = await service.generate()
    expect(notice).to.eq('** test; version 1.0.0 -- \n\n%%%This is the attachment%%%')
  })

  it('renders with custom template', async () => {
    const { service } = setup({
      'npm/npmjs/-/test/1.0.0': {
        coordinates: { name: 'test', revision: '1.0.0' },
        licensed: { declared: 'MIT' }
      },
      'npm/npmjs/-/test/2.0.0': {
        coordinates: { name: 'test', revision: '2.0.0' },
        licensed: { declared: 'Apache-2.0' }
      }
    })
    const notice = await service.generate(
      {},
      'HEADER CONTENT\n\n\n----\n\n{{#buckets}}\n{{#packages}}\n\n----\n\n{{{name}}} {{{version}}} - {{{../name}}}\n{{/packages}}{{/buckets}}\n'
    )
    expect(notice).to.eq(
      'HEADER CONTENT\n\n\n----\n\n\n----\n\ntest 2.0.0 - Apache-2.0\n\n----\n\ntest 1.0.0 - MIT\n\n'
    )
  })

  it('generates empty notices for no defintions', async () => {
    const { service } = setup({})
    const notice = await service.generate()
    expect(notice).to.eq('')
  })
})

function setup(defintions, attachments = {}) {
  const attachmentStore = { get: token => attachments[token] }
  const definitionService = { getAll: sinon.stub().returns(Promise.resolve(defintions)) }
  const service = NoticeService(definitionService, attachmentStore)
  return { service }
}
