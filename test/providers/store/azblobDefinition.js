// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/azblobDefinitionStore')
const sinon = require('sinon')
const { expect } = require('chai')

describe('azblob Definition store', () => {
  it('should list coordinates', async () => {
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
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/co/4.6.0'])
  })

  it('should list coordinates preserving case from blob metadata', async () => {
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
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/JSONStream/1.3.4'])

    const resultCased = await store.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'jsonstream',
      revision: '1.3.4'
    })
    expect(resultCased).to.equalInAnyOrder(['npm/npmjs/-/JSONStream/1.3.4'])
  })

  it('list coordinates with partial coordinates', async () => {
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
    expect(result).to.equalInAnyOrder(['npm/npmjs/-/co/3.6.0', 'npm/npmjs/-/co/4.6.0'])
  })
})

function createAzBlobStore(entries, withMetadata) {
  const blobServiceStub = {
    listBlobsSegmentedWithPrefix: sinon.stub().callsArgWith(withMetadata ? 4 : 3, null, { entries }),
    getBlobToText: sinon.stub().callsArgWith(2, null, '{}')
  }
  const store = Store({})
  store.blobService = blobServiceStub
  return store
}
