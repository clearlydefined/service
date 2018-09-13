// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AttachmentCoordinates = require('../../../lib/attachmentCoordinates')
const AzBlobStore = require('../../../providers/stores/azblob')
const assert = require('assert')
const sinon = require('sinon')

describe('azblob store', () => {
  it('should list entities', async () => {
    const azblobStore = createAzBlobStore(
      [
        {
          name: 'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
          metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:clearlydefined:1' }
        },
        {
          name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
          metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:scancode:2.2.1' }
        }
      ],
      true
    )

    const result = await azblobStore.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'co',
      revision: '4.6.0'
    })
    assert.equal(result.length, 1)
    assert.equal(result[0], 'npm/npmjs/-/co/4.6.0')
  })

  it('should list entities preserving case from blob metadata', async () => {
    const azblobStore = createAzBlobStore(
      [
        {
          name: 'npm/npmjs/-/jsonstream/revision/1.3.4/tool/clearlydefined/1.json',
          metadata: { urn: 'urn:npm:npmjs:-:JSONStream:revision:1.3.4:tool:clearlydefined:1' }
        },
        {
          name: 'npm/npmjs/-/jsonstream/revision/1.3.4/tool/scancode/2.2.1.json',
          metadata: { urn: 'urn:npm:npmjs:-:JSONStream:revision:1.3.4:tool:scancode:2.2.1' }
        }
      ],
      true
    )

    const result = await azblobStore.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'JSONStream',
      revision: '1.3.4'
    })
    assert.equal(result.length, 1)
    assert.equal(result[0], 'npm/npmjs/-/JSONStream/1.3.4')

    const resultCased = await azblobStore.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'jsonstream',
      revision: '1.3.4'
    })
    assert.equal(resultCased.length, 1)
    assert.equal(resultCased[0], 'npm/npmjs/-/JSONStream/1.3.4')
  })

  it('list entities with partial coordinates', async () => {
    const azblobStore = createAzBlobStore(
      [
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
      ],
      true
    )

    const result = await azblobStore.list({
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'co'
    })
    assert.equal(result.length, 2)
    assert.deepEqual(result, ['npm/npmjs/-/co/3.6.0', 'npm/npmjs/-/co/4.6.0'])
  })

  it('should list results', async () => {
    const azblobStore = createAzBlobStore(
      [
        {
          name: 'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
          metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:clearlydefined:1' }
        },
        {
          name: 'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
          metadata: { urn: 'urn:npm:npmjs:-:co:revision:4.6.0:tool:scancode:2.2.1' }
        }
      ],
      true
    )

    const result = await azblobStore.list(
      {
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'co',
        revision: '4.6.0'
      },
      'result'
    )
    assert.equal(result.length, 2)
    assert.deepEqual(result, ['npm/npmjs/-/co/4.6.0/clearlydefined/1', 'npm/npmjs/-/co/4.6.0/scancode/2.2.1'])
  })

  it('should list results preserving case from blob metadata', async () => {
    const azblobStore = createAzBlobStore(
      [
        {
          name: 'npm/npmjs/-/jsonstream/revision/1.3.4/tool/clearlydefined/1.json',
          metadata: { urn: 'urn:npm:npmjs:-:JSONStream:revision:1.3.4:tool:clearlydefined:1' }
        },
        {
          name: 'npm/npmjs/-/jsonstream/revision/1.3.4/tool/scancode/2.2.1.json',
          metadata: { urn: 'urn:npm:npmjs:-:JSONStream:revision:1.3.4:tool:scancode:2.2.1' }
        }
      ],
      true
    )

    const result = await azblobStore.list(
      {
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'JSONStream',
        revision: '1.3.4'
      },
      'result'
    )
    assert.equal(result.length, 2)
    assert.deepEqual(result, [
      'npm/npmjs/-/JSONStream/1.3.4/clearlydefined/1',
      'npm/npmjs/-/JSONStream/1.3.4/scancode/2.2.1'
    ])

    const resultCased = await azblobStore.list(
      {
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'jsonstream',
        revision: '1.3.4'
      },
      'result'
    )
    assert.equal(resultCased.length, 2)
    assert.deepEqual(resultCased, [
      'npm/npmjs/-/JSONStream/1.3.4/clearlydefined/1',
      'npm/npmjs/-/JSONStream/1.3.4/scancode/2.2.1'
    ])
  })

  it('should list results with partial coordinates', async () => {
    const azblobStore = createAzBlobStore(
      [
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
      ],
      true
    )

    const result = await azblobStore.list(
      {
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'co'
      },
      'result'
    )
    assert.equal(result.length, 4)
    assert.deepEqual(result, [
      'npm/npmjs/-/co/3.6.0/clearlydefined/1',
      'npm/npmjs/-/co/3.6.0/scancode/1.2.1',
      'npm/npmjs/-/co/4.6.0/clearlydefined/1',
      'npm/npmjs/-/co/4.6.0/scancode/2.2.1'
    ])
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

  it('should get attachment', async () => {
    const { blobServiceStub, azBlobStore } = createAzBlobAttachmentStore({
      _metadata: {
        type: 'attachment',
        url: 'cd:/attachment/thisisaid'
      },
      attachment: 'The attachmentText'
    })

    const attachment = await azBlobStore.getAttachment(new AttachmentCoordinates('thisisaid'))

    assert.ok(blobServiceStub.getBlobToText.calledWith(undefined, 'attachment/thisisaid.json'))
    assert.equal(attachment._metadata.type, 'attachment')
    assert.equal(attachment._metadata.url, 'cd:/attachment/thisisaid')
    assert.equal(attachment.attachment, 'The attachmentText')
  })
})

function createAzBlobStore(entries, withMetadata) {
  const blobServiceStub = {
    listBlobsSegmentedWithPrefix: sinon.stub().callsArgWith(withMetadata ? 4 : 3, null, { entries }),
    getBlobToText: sinon.stub().callsArgWith(2, null, '{}'),
    createContainerIfNotExists: sinon.stub().callsArgWith(1, null)
  }
  blobServiceStub.withFilter = sinon.stub().returns(blobServiceStub)
  const azBlobStore = AzBlobStore({})
  sinon.stub(azBlobStore, 'blobService').get(() => blobServiceStub)
  return azBlobStore
}

function createAzBlobAttachmentStore(attachment) {
  const blobServiceStub = {
    getBlobToText: sinon.stub().callsArgWith(2, null, JSON.stringify(attachment)),
    createContainerIfNotExists: sinon.stub().callsArgWith(1, null)
  }
  const azBlobStore = AzBlobStore({})
  sinon.stub(azBlobStore, 'blobService').get(() => blobServiceStub)

  return { blobServiceStub, azBlobStore }
}
