// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Store = require('../../../providers/stores/azblobHarvestStore')
const sinon = require('sinon')
const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
chai.use(deepEqualInAnyOrder)
const expect = chai.expect
const AbstractFileStore = require('../../../providers/stores/abstractFileStore')

describe('azblob Harvest store', () => {
  describe('list', () => {
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
  })

  describe('getAll', () => {
    it('handles tool output', async () => {
      const azblobStore = createAzBlobStore(
        createEntries([
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.14.0.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.1.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/30.3.0.json'
        ])
      )

      const result = await azblobStore.getAll({
        type: 'maven',
        provider: 'mavencentral',
        namespace: 'org.apache.httpcomponents',
        name: 'httpcore',
        revision: '4.4.16'
      })

      const tools = Object.getOwnPropertyNames(result)
      expect(tools.length).to.eq(4)
      const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
      expect(clearlydefinedVersions[0]).to.eq('1.5.0')
      expect(clearlydefinedVersions.length).to.eq(1)
      const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
      expect(scancodeVersions).to.equalInAnyOrder(['32.3.0', '30.3.0'])
      const licenseeVersions = Object.getOwnPropertyNames(result.licensee)
      expect(licenseeVersions).to.equalInAnyOrder(['9.18.1', '9.14.0'])
      const reuseVersions = Object.getOwnPropertyNames(result.reuse)
      expect(reuseVersions).to.equalInAnyOrder(['3.2.1', '3.2.2'])
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

  describe('_getLatestToolVersions', () => {
    let store
    beforeEach(() => {
      store = Store({})
    })
    it('should get latest tool versions', () => {
      let latest = store._getLatestToolVersions([
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.14.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.1.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/30.3.0.json'
      ])
      expect(latest).to.equalInAnyOrder([
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json'
      ])
    })
    it('should get latest tool versions and ignore un-versioned data', () => {
      let latest = store._getLatestToolVersions([
        'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
        'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
        'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.1.json',
        'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.2.json',
        'npm/npmjs/-/co/revision/4.6.0/tool/scancode.json'
      ])
      expect(latest).to.equalInAnyOrder([
        'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
        'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.2.json'
      ])
    })
    it('should get latest tool versions and ignore invalid semver', () => {
      let latest = store._getLatestToolVersions([
        'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.10.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.2.1.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.2.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/3.2.2.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/30.3.0.json'
      ])
      expect(latest).to.equalInAnyOrder([
        'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/30.3.0.json'
      ])
    })

    it('should ignore invalid semver, invalid sermver first', () => {
      let latest = store._getLatestToolVersions([
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'
      ])
      expect(latest).to.equalInAnyOrder(['npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'])
    })

    it('should ignore invalid semver, invalid sermver last', () => {
      let latest = store._getLatestToolVersions([
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
      ])
      expect(latest).to.equalInAnyOrder(['npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'])
    })

    it('should return at least the first tool version', () => {
      let latest = store._getLatestToolVersions([
        'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
      ])
      expect(latest).to.equalInAnyOrder([
        'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
      ])
    })
  })

  describe('getAllLatest', () => {
    it('retrieves latest entries', async () => {
      const azblobStore = createAzBlobStore(
        createEntries([
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.14.0.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.1.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json',
          'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/30.3.0.json'
        ])
      )

      const result = await azblobStore.getAllLatest({
        type: 'maven',
        provider: 'mavencentral',
        namespace: 'org.apache.httpcomponents',
        name: 'httpcore',
        revision: '4.4.16'
      })

      const tools = Object.getOwnPropertyNames(result)
      expect(tools.length).to.eq(4)
      const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
      expect(clearlydefinedVersions).to.deep.eq(['1.5.0'])
      const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
      expect(scancodeVersions).to.deep.eq(['32.3.0'])
      const licenseeVersions = Object.getOwnPropertyNames(result.licensee)
      expect(licenseeVersions).to.deep.eq(['9.18.1'])
      const reuseVersions = Object.getOwnPropertyNames(result.reuse)
      expect(reuseVersions).to.deep.eq(['3.2.2'])
    })

    it('retrieves latest entries ignoring unversioned result', async () => {
      const azblobStore = createAzBlobStore(
        createEntries([
          'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.2.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.0b1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode.json'
        ])
      )

      const result = await azblobStore.getAllLatest({
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'co',
        revision: '4.6.0'
      })
      const tools = Object.getOwnPropertyNames(result)
      expect(tools.length).to.eq(2)
      const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
      expect(clearlydefinedVersions).to.deep.eq(['1'])
      const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
      expect(scancodeVersions).to.deep.eq(['2.9.2'])
    })

    it('should fall back to getAll when there is no latest', async () => {
      const azblobStore = createAzBlobStore(
        createEntries([
          'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.0b1.json'
        ])
      )
      azblobStore.logger = { error: sinon.stub() }
      azblobStore._getLatestToolVersions = sinon.stub().throws(new Error('test error'))
      const result = await azblobStore.getAllLatest({
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'co',
        revision: '4.6.0'
      })
      const tools = Object.getOwnPropertyNames(result)
      expect(tools.length).to.eq(2)
      const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
      expect(clearlydefinedVersions).to.deep.eq(['1'])
      const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
      expect(scancodeVersions).to.deep.eq(['2.2.1', '2.9.1', '2.9.0b1'])
      expect(azblobStore.logger.error.calledOnce).to.be.true
    })
  })
})

function createEntries(names) {
  return names.map(name => ({ name }))
}

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
