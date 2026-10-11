// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import sinon from 'sinon'
import Store from '../../../providers/stores/azblobHarvestStore.ts'

chai.use(deepEqualInAnyOrder)
const expect = chai.expect

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
      expect(result).to.deep.equalInAnyOrder(expected)
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
      expect(resultCased).to.deep.equalInAnyOrder(expected)
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
      expect(result).to.deep.equalInAnyOrder(expected)
    })

    it('lists with a prefix ending at a path segment', async () => {
      const store = createAzBlobStore([], true)
      const listPrefix = async coordinates => {
        await store.list(coordinates)
        return store.blobService.listBlobsSegmentedWithPrefix.lastCall.args[1]
      }
      const name = { type: 'nuget', provider: 'nuget', namespace: null, name: 'Foo.Bar' }

      expect(await listPrefix({})).to.eq('')
      expect(await listPrefix({ type: 'nuget' })).to.eq('nuget/')
      expect(await listPrefix({ ...name, revision: '1.0.0' })).to.eq('nuget/nuget/-/foo.bar/revision/1.0.0/')
      expect(await listPrefix({ ...name, revision: '1.0.0', tool: 'scancode' })).to.eq(
        'nuget/nuget/-/foo.bar/revision/1.0.0/tool/scancode/'
      )
      expect(await listPrefix({ ...name, revision: '1.0.0', tool: 'scancode', toolVersion: '32.3.0' })).to.eq(
        'nuget/nuget/-/foo.bar/revision/1.0.0/tool/scancode/32.3.0'
      )
    })
  })

  describe('list of all revisions', () => {
    const blob = (name, revision, tool) => ({
      name: `nuget/nuget/-/${name.toLowerCase()}/revision/${revision}/tool/${tool}/1.json`,
      metadata: { urn: `urn:nuget:nuget:-:${name}:revision:${revision}:tool:${tool}:1` }
    })
    const data = [
      blob('Foo', '1.0.0', 'clearlydefined'),
      blob('Foo', '1.0.0', 'scancode'),
      blob('Foo', '1.0.0-beta', 'clearlydefined'),
      blob('Foo', '2.0.0', 'clearlydefined'),
      blob('Foo.Bar', '1.0.0', 'clearlydefined')
    ]
    const coordinates = { type: 'nuget', provider: 'nuget', namespace: null, name: 'Foo' }

    it('lists each revision of the component', async () => {
      const store = createAzBlobStore(data, true)

      const result = await store.list(coordinates)

      expect(result).to.deep.equal([
        'nuget/nuget/-/Foo/1.0.0-beta/clearlydefined/1',
        'nuget/nuget/-/Foo/1.0.0/clearlydefined/1',
        'nuget/nuget/-/Foo/1.0.0/scancode/1',
        'nuget/nuget/-/Foo/2.0.0/clearlydefined/1'
      ])
      expect(store.blobService.listBlobDirectoriesSegmentedWithPrefix.lastCall.args[1]).to.eq(
        'nuget/nuget/-/foo/revision/'
      )
      const listed = store.blobService.listBlobsSegmentedWithPrefix.args.map(args => args[1])
      expect(listed).to.deep.equalInAnyOrder([
        'nuget/nuget/-/foo/revision/1.0.0-beta/',
        'nuget/nuget/-/foo/revision/1.0.0/',
        'nuget/nuget/-/foo/revision/2.0.0/'
      ])
    })

    it('lists nothing for a component without results', async () => {
      const store = createAzBlobStore(data, true)

      expect(await store.list({ ...coordinates, name: 'Fo' })).to.deep.equal([])
      expect(store.blobService.listBlobsSegmentedWithPrefix.called).to.be.false
    })

    it('stops when aborted', async () => {
      const store = createAzBlobStore(data, true)
      const controller = new AbortController()
      store.blobService.listBlobDirectoriesSegmentedWithPrefix.callsFake((_container, _prefix, _token, callback) => {
        controller.abort()
        callback(null, { entries: [{ name: 'nuget/nuget/-/foo/revision/1.0.0/' }] })
      })

      let error
      await store.list(coordinates, { signal: controller.signal }).catch(e => (error = e))

      expect(error?.name).to.eq('AbortError')
      expect(store.blobService.listBlobsSegmentedWithPrefix.called).to.be.false
    })
  })

  describe('list options', () => {
    const page = (revision, continuationToken?) => ({
      entries: [
        {
          name: `npm/npmjs/-/co/revision/${revision}/tool/clearlydefined/1.json`,
          metadata: { urn: `urn:npm:npmjs:-:co:revision:${revision}:tool:clearlydefined:1` }
        },
        {
          name: `npm/npmjs/-/co/revision/${revision}/tool/scancode/2.json`,
          metadata: { urn: `urn:npm:npmjs:-:co:revision:${revision}:tool:scancode:2` }
        }
      ],
      continuationToken
    })
    const createPagedStore = () => {
      const store = createAzBlobStore([], true)
      store.blobService.listBlobsSegmentedWithPrefix = sinon
        .stub()
        .onFirstCall()
        .callsArgWith(4, null, page('1.0.0', 'next'))
        .onSecondCall()
        .callsArgWith(4, null, page('2.0.0', 'more'))
        .onThirdCall()
        .callsArgWith(4, null, page('3.0.0'))
      return store
    }

    it('lists all pages', async () => {
      const store = createPagedStore()

      const result = await store.list({ type: 'npm' })

      expect(result).to.have.lengthOf(6)
      expect(store.blobService.listBlobsSegmentedWithPrefix.callCount).to.eq(3)
    })

    it('stops listing once there are more results than the limit', async () => {
      const store = createPagedStore()

      const result = await store.list({ type: 'npm' }, { limit: 3 })

      expect(result).to.have.lengthOf(4)
      expect(store.blobService.listBlobsSegmentedWithPrefix.callCount).to.eq(2)
    })

    it('stops listing when aborted', async () => {
      const store = createPagedStore()
      const controller = new AbortController()
      store.blobService.listBlobsSegmentedWithPrefix.onSecondCall().callsFake((_c, _p, _t, _o, callback) => {
        controller.abort()
        callback(null, page('2.0.0', 'more'))
      })

      let error
      await store.list({ type: 'npm' }, { signal: controller.signal }).catch(e => (error = e))

      expect(error?.name).to.eq('AbortError')
      expect(store.blobService.listBlobsSegmentedWithPrefix.callCount).to.eq(2)
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
      expect(scancodeVersions).to.deep.equalInAnyOrder(['32.3.0', '30.3.0'])
      const licenseeVersions = Object.getOwnPropertyNames(result.licensee)
      expect(licenseeVersions).to.deep.equalInAnyOrder(['9.18.1', '9.14.0'])
      const reuseVersions = Object.getOwnPropertyNames(result.reuse)
      expect(reuseVersions).to.deep.equalInAnyOrder(['3.2.1', '3.2.2'])
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

  describe('getAllLatest', () => {
    it('should get latest tool versions', () => {
      const store = Store({} as any) as any
      const latest = store._getLatestToolPaths([
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.14.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.1.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/30.3.0.json'
      ])
      expect(Array.from(latest)).to.deep.equalInAnyOrder([
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json'
      ])
    })

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

      const exptected = {
        clearlydefined: { '1.5.0': {} },
        licensee: { '9.18.1': {} },
        reuse: { '3.2.2': {} },
        scancode: { '32.3.0': {} }
      }
      expect(result).to.deep.equal(exptected)
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
      const exptected = { clearlydefined: { 1: {} }, scancode: { '2.9.2': {} } }
      expect(result).to.deep.equal(exptected)
    })

    it('should fall back to getAll when there is error', async () => {
      const azblobStore = createAzBlobStore(
        createEntries([
          'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.1.json',
          'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.0b1.json'
        ])
      )
      azblobStore.logger = { error: sinon.stub() }
      azblobStore._getLatestToolPaths = sinon.stub().throws(new Error('test error'))
      const result = await azblobStore.getAllLatest({
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'co',
        revision: '4.6.0'
      })
      const exptected = { clearlydefined: { 1: {} }, scancode: { '2.2.1': {}, '2.9.1': {}, '2.9.0b1': {} } }
      expect(result).to.deep.equal(exptected)
    })
  })
})

function createEntries(names) {
  return names.map(name => ({ name }))
}

function createAzBlobStore(entries, withMetadata?) {
  const blobServiceStub: Record<string, any> = {
    listBlobsSegmentedWithPrefix: withMetadata
      ? sinon
          .stub()
          .callsFake((_container, prefix, _token, _options, callback) =>
            callback(null, { entries: entries.filter(entry => entry.name.startsWith(prefix)) })
          )
      : sinon.stub().callsArgWith(3, null, { entries }),
    listBlobDirectoriesSegmentedWithPrefix: sinon.stub().callsFake((_container, prefix, _token, callback) => {
      const names = entries
        .filter(entry => entry.name.startsWith(prefix))
        .map(entry => `${prefix}${entry.name.slice(prefix.length).split('/')[0]}/`)
      callback(null, { entries: [...new Set(names)].sort().map(name => ({ name })) })
    }),
    getBlobToText: sinon.stub().callsArgWith(2, null, '{}'),
    createContainerIfNotExists: sinon.stub().callsArgWith(1, null)
  }
  blobServiceStub.withFilter = sinon.stub().returns(blobServiceStub)
  const store = Store({} as any)
  ;(store as any).blobService = blobServiceStub
  return store as any
}
