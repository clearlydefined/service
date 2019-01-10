// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/azblobHarvestStore')
const sinon = require('sinon')
const { expect } = require('chai')

describe('azblob Harvest store', () => {
  it('should list results', async () => {
    const data = [
      {
        name: 'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
        metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:clearlydefined:1' }
      },
      {
        name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
        metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:scancode:2.2.1' }
      }
    ]
    const store = createAzBlobStore(data, true)

    const result = await store.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'co',
      revision: '4.6.0'
    })
    const expected = ['npm/npmjs/-/co/4.6.0/clearlydefined/1', 'npm/npmjs/-/co/4.6.0/scancode/2.2.1']
    expect(result).to.equalInAnyOrder(expected)
  })

  it('should list results preserving case from blob metadata', async () => {
    const data = [
      {
        name: 'npm/npmjs/-/jsonstream/revision/1.3.4/tool/clearlydefined/1.json',
        metadata: { urn: 'urn:npm:npmjs:-:JSONStream:revision:1.3.4:tool:clearlydefined:1' }
      },
      {
        name: 'npm/npmjs/-/jsonstream/revision/1.3.4/tool/scancode/2.2.1.json',
        metadata: { urn: 'urn:npm:npmjs:-:JSONStream:revision:1.3.4:tool:scancode:2.2.1' }
      }
    ]
    const store = createAzBlobStore(data, true)

    const result = await store.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'JSONStream',
      revision: '1.3.4'
    })
    const expected = ['npm/npmjs/-/JSONStream/1.3.4/clearlydefined/1', 'npm/npmjs/-/JSONStream/1.3.4/scancode/2.2.1']
    expect(result).to.be.deep.equalInAnyOrder(expected)

    const resultCased = await store.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'jsonstream',
      revision: '1.3.4'
    })
    expect(resultCased).to.equalInAnyOrder(expected)
  })

  it('list results with partial coordinates', async () => {
    const data = [
      {
        name: 'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
        metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:clearlydefined:1' }
      },
      {
        name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
        metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:scancode:2.2.1' }
      },
      {
        name: 'npm/npmjs/-/co/revision/3.6.0/tool/clearlydefined/1.json',
        metadata: { urn: 'urn:npm:npmjs:-:co:revision:3.6.0:tool:clearlydefined:1' }
      },
      {
        name: 'npm/npmjs/-/co/revision/3.6.0/tool/scancode/1.2.1.json',
        metadata: { urn: 'urn:npm:npmjs:-:co:revision:3.6.0:tool:scancode:1.2.1' }
      }
    ]
    const store = createAzBlobStore(data, true)

    const result = await store.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'co'
    })
    const expected = [
      'npm/npmjs/-/co/3.6.0/clearlydefined/1',
      'npm/npmjs/-/co/3.6.0/scancode/1.2.1',
      'npm/npmjs/-/co/4.6.0/clearlydefined/1',
      'npm/npmjs/-/co/4.6.0/scancode/2.2.1'
    ]
    expect(result).to.equalInAnyOrder(expected)
  })

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
    expect(tools.length).to.eq(2)
    const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
    expect(clearlydefinedVersions[0]).to.eq('1')
    expect(clearlydefinedVersions.length).to.eq(1)
    const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
    expect(scancodeVersions[0]).to.eq('2.2.1')
    expect(scancodeVersions[1]).to.eq('2.9.1')
    expect(scancodeVersions[2]).to.eq('2.9.2')
    expect(scancodeVersions.length).to.eq(3)
  })
})

function createAzBlobStore(entries, withMetadata) {
  const blobServiceStub = {
    listBlobsSegmentedWithPrefix: sinon.stub().callsArgWith(withMetadata ? 4 : 3, null, { entries }),
    getBlobToText: sinon.stub().callsArgWith(2, null, '{}'),
    createContainerIfNotExists: sinon.stub().callsArgWith(1, null)
  }
  blobServiceStub.withFilter = sinon.stub().returns(blobServiceStub)
  const store = Store({})
  store.blobService = blobServiceStub
  return store
}
