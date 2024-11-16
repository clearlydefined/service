// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
chai.use(deepEqualInAnyOrder)
const expect = chai.expect
const EntityCoordinates = require('../../../lib/entityCoordinates')
const AbstractFileStore = require('../../../providers/stores/abstractFileStore')

describe('AbstractFileStore lists entries ', () => {
  let FileStore
  const data = {
    '/foo/npm/npmjs/-/test/revision/1.0/tool/testtool/2.0.json': {},
    '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool0/1.0.json': {},
    '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool1/2.0.json': {},
    '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool2/3.0.json': {}
  }

  beforeEach(function () {
    const recursiveStub = async path => {
      path = path.replace(/\\/g, '/')
      if (path.includes('error')) throw new Error('test error')
      const result = Object.keys(data).filter(p => p.startsWith(path))
      if (result.length === 0) {
        const error = new Error('test')
        error.code = 'ENOENT'
        throw error
      }
      return result.filter(p => p !== path)
    }
    const fsStub = {
      readFile: (path, cb) => {
        cb(null, JSON.stringify({ path }))
      }
    }
    FileStore = proxyquire('../../../providers/stores/abstractFileStore', {
      'recursive-readdir': recursiveStub,
      fs: fsStub
    })
  })

  afterEach(function () {
    sandbox.restore()
  })

  it('throws original error when not ENOENT', async () => {
    const fileStore = new FileStore({ location: '/foo' })
    try {
      await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'error', '0.0'), data => data)
      throw new Error('should have thrown error')
    } catch (error) {
      expect(error.message).to.eq('test error')
    }
  })

  it('works for unknown path coordinates ', async () => {
    const fileStore = new FileStore({ location: '/foo' })
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'bogus', '0.0'), data => data)
    expect(result.length).to.eq(0)
  })

  it('lists no files', async () => {
    const fileStore = new FileStore({ location: '/foo' })
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '0.0'), data => data)
    expect(result.length).to.eq(0)
  })

  it('lists single files', async () => {
    const fileStore = new FileStore({ location: '/foo' })
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '1.0'), data => data)
    expect(result.length).to.eq(1)
    expect(result[0].path).to.eq('/foo/npm/npmjs/-/test/revision/1.0/tool/testtool/2.0.json')
  })

  it('lists multiple files', async () => {
    const fileStore = new FileStore({ location: '/foo' })
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '2.0'), data => data)
    const expected = [
      '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool0/1.0.json',
      '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool1/2.0.json',
      '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool2/3.0.json'
    ]
    expect(result.map(entry => entry.path)).to.equalInAnyOrder(expected)
  })
})

describe('coordinates to path mapping', () => {
  const windows = 'c:\\foo\\bar'
  const linux = '/foo/bar'
  const data = [
    {
      location: linux,
      path: 'npm/npmjs/namespace/name/revision/1.0',
      coordinates: {
        type: 'npm',
        provider: 'npmjs',
        namespace: 'namespace',
        name: 'name',
        revision: '1.0',
        tool: undefined,
        toolVersion: undefined
      }
    },
    {
      location: linux,
      path: 'npm/npmjs/namespace/name/revision/1.0/tool/testtool/2.0',
      coordinates: {
        type: 'npm',
        provider: 'npmjs',
        namespace: 'namespace',
        name: 'name',
        revision: '1.0',
        tool: 'testtool',
        toolVersion: '2.0'
      }
    },
    {
      location: linux,
      path: 'npm/npmjs/namespace/name',
      coordinates: {
        type: 'npm',
        provider: 'npmjs',
        namespace: 'namespace',
        name: 'name',
        revision: undefined,
        tool: undefined,
        toolVersion: undefined
      }
    },
    {
      location: linux,
      path: 'npm/npmjs/-/name/revision/1.0',
      coordinates: {
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'name',
        revision: '1.0',
        tool: undefined,
        toolVersion: undefined
      }
    },
    {
      location: windows,
      path: 'npm\\npmjs\\namespace\\name\\revision\\1.0',
      coordinates: {
        type: 'npm',
        provider: 'npmjs',
        namespace: 'namespace',
        name: 'name',
        revision: '1.0',
        tool: undefined,
        toolVersion: undefined
      }
    },
    {
      location: windows,
      path: 'npm\\npmjs\\namespace\\name',
      coordinates: {
        type: 'npm',
        provider: 'npmjs',
        namespace: 'namespace',
        name: 'name',
        revision: undefined,
        tool: undefined,
        toolVersion: undefined
      }
    },
    {
      location: windows,
      path: 'npm\\npmjs\\-\\name\\revision\\1.0',
      coordinates: {
        type: 'npm',
        provider: 'npmjs',
        namespace: null,
        name: 'name',
        revision: '1.0',
        tool: undefined,
        toolVersion: undefined
      }
    }
  ]

  const AbstractFileStore = require('../../../providers/stores/abstractFileStore')
  data.forEach(input => {
    it('works well for ' + input.path, () => {
      const fileStore = new AbstractFileStore({ location: input.location })
      const separator = input.location.includes('/') ? '/' : '\\'
      const result = fileStore._toStoragePathFromCoordinates(input.coordinates)
      // account for platform differences in path separator.
      const normalizedResult = result.replace(/\\/g, '/')
      const normalizedInput = (input.location + separator + input.path).replace(/\\/g, '/')
      expect(normalizedResult).to.deep.equal(normalizedInput)
    })
  })
})

describe('getLatestToolVersions', () => {
  it('should get latest tool versions', () => {
    const latest = AbstractFileStore.getLatestToolPaths([
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.14.0.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.1.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/30.3.0.json'
    ])
    expect(Array.from(latest)).to.equalInAnyOrder([
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/clearlydefined/1.5.0.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/licensee/9.18.1.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/reuse/3.2.2.json',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/revision/4.4.16/tool/scancode/32.3.0.json'
    ])
  })
  it('should get latest tool versions and ignore un-versioned data', () => {
    const latest = AbstractFileStore.getLatestToolPaths([
      'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
      'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.2.1.json',
      'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.1.json',
      'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.2.json',
      'npm/npmjs/-/co/revision/4.6.0/tool/scancode.json'
    ])
    expect(Array.from(latest)).to.equalInAnyOrder([
      'npm/npmjs/-/co/revision/4.6.0/tool/clearlydefined/1.json',
      'npm/npmjs/-/co/revision/4.6.0/tool/scancode/2.9.2.json'
    ])
  })
  it('should get latest tool versions and ignore invalid semver', () => {
    const latest = AbstractFileStore.getLatestToolPaths([
      'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.10.0.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.2.1.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.2.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/3.2.2.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/30.3.0.json'
    ])
    expect(Array.from(latest)).to.equalInAnyOrder([
      'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/30.3.0.json'
    ])
  })

  it('should ignore invalid semver, invalid sermver first', () => {
    const latest = AbstractFileStore.getLatestToolPaths([
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'
    ])
    expect(Array.from(latest)).to.equalInAnyOrder(['npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'])
  })

  it('should ignore invalid semver, invalid sermver last', () => {
    const latest = AbstractFileStore.getLatestToolPaths([
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
    ])
    expect(Array.from(latest)).to.equalInAnyOrder(['npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'])
  })

  it('should return at least the first tool version', () => {
    const latest = AbstractFileStore.getLatestToolPaths([
      'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
    ])
    expect(Array.from(latest)).to.equalInAnyOrder([
      'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
      'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
    ])
  })
})
