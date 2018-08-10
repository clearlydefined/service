// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AzBlobStore = require('../../../providers/stores/azblob')
const assert = require('assert')
const sinon = require('sinon')

describe('azblob store getall tool outputs', () => {
  it('handles unversioned tool output', async () => {
    const azblobStore = createAzBlobStore([
      { name: 'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json' },
      { name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json' },
      { name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.1.json' },
      { name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.2.json' },
      { name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode.json' } // this is the problem file see https://github.com/clearlydefined/service/issues/184
    ])

    const result = await azblobStore.getAll({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'co',
      revision: '4.6.0'
    })

    const tools = Object.getOwnPropertyNames(result)
    assert.equal(tools.length, 2)
    const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
    assert.equal(clearlydefinedVersions[0], '1')
    assert.equal(clearlydefinedVersions.length, 1)
    const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
    assert.equal(scancodeVersions[0], '2.2.1')
    assert.equal(scancodeVersions[1], '2.9.1')
    assert.equal(scancodeVersions[2], '2.9.2')
    assert.equal(scancodeVersions.length, 3)
  })
})

function createAzBlobStore(entries) {
  const blobServiceStub = {
    listBlobsSegmentedWithPrefix: sinon.stub().callsArgWith(3, null, { entries }),
    getBlobToText: sinon.stub().callsArgWith(2, null, '{}'),
    createContainerIfNotExists: sinon.stub().callsArgWith(1, null)
  }
  blobServiceStub.withFilter = sinon.stub().returns(blobServiceStub)
  const azBlobStore = AzBlobStore({})
  sinon.stub(azBlobStore, 'blobService').get(() => blobServiceStub)
  return azBlobStore
}
