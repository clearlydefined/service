// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AttachmentCoordinates = require('../../../lib/attachmentCoordinates')
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

  it('should get attachment', async () => {
    const { blobServiceStub, store } = createAzBlobAttachmentStore({
      _metadata: {
        type: 'attachment',
        url: 'cd:/attachment/thisisaid'
      },
      attachment: 'The attachmentText'
    })
    const attachment = await store.getAttachment(new AttachmentCoordinates('thisisaid'))

    expect(blobServiceStub.getBlobToText.calledWith(undefined, 'attachment/thisisaid.json')).to.be.true
    expect(attachment._metadata.type).to.eq('attachment')
    expect(attachment._metadata.url).to.eq('cd:/attachment/thisisaid')
    expect(attachment.attachment).to.eq('The attachmentText')
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

function createAzBlobAttachmentStore(attachment) {
  const blobServiceStub = {
    getBlobToText: sinon.stub().callsArgWith(2, null, JSON.stringify(attachment)),
    createContainerIfNotExists: sinon.stub().callsArgWith(1, null)
  }
  const store = Store({})
  store.blobService = blobServiceStub
  return { blobServiceStub, store }
}
