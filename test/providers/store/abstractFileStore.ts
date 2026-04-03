import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { assertDeepEqualInAnyOrder } from '../../helpers/assert.ts'

// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const EntityCoordinates = require('../../../lib/entityCoordinates')
const AbstractFileStore = require('../../../providers/stores/abstractFileStore')

describe('AbstractFileStore', () => {
  const logger = {
    debug: mock.fn(),
    error: mock.fn()
  }

  describe('AbstractFileStore lists entries ', () => {
    let FileStore
    let fileStore
    const data = {
      '/foo/npm/npmjs/-/test/revision/1.0/tool/testtool/2.0.json': {},
      '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool0/1.0.json': {},
      '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool1/2.0.json': {},
      '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool2/3.0.json': {}
    }

    beforeEach(() => {
      const recursiveStub = async path => {
        path = path.replace(/\\/g, '/')
        if (path.includes('error')) {
          throw new Error('test error')
        }
        const result = Object.keys(data).filter(p => p.startsWith(path))
        if (result.length === 0) {
          const error = new Error('test') as Error & { code: string }
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
        'node:fs': fsStub
      })
      fileStore = new FileStore({ location: '/foo', logger })
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('throws original error when not ENOENT', async () => {
      try {
        await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'error', '0.0'), data => data)
        throw new Error('should have thrown error')
      } catch (error) {
        assert.strictEqual(error.message, 'test error')
      }
    })

    it('works for unknown path coordinates ', async () => {
      const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'bogus', '0.0'), data => data)
      assert.strictEqual(result.length, 0)
    })

    it('lists no files', async () => {
      const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '0.0'), data => data)
      assert.strictEqual(result.length, 0)
    })

    it('lists single files', async () => {
      const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '1.0'), data => data)
      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].path, '/foo/npm/npmjs/-/test/revision/1.0/tool/testtool/2.0.json')
    })

    it('lists multiple files', async () => {
      const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '2.0'), data => data)
      const expected = [
        '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool0/1.0.json',
        '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool1/2.0.json',
        '/foo/npm/npmjs/-/test/revision/2.0/tool/testtool2/3.0.json'
      ]
      assertDeepEqualInAnyOrder(
        result.map(entry => entry.path),
        expected
      )
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
    for (const input of data) {
      it(`works well for ${input.path}`, () => {
        const fileStore = new AbstractFileStore({ location: input.location, logger })
        const separator = input.location.includes('/') ? '/' : '\\'
        const result = fileStore._toStoragePathFromCoordinates(input.coordinates)
        // account for platform differences in path separator.
        const normalizedResult = result.replace(/\\/g, '/')
        const normalizedInput = (input.location + separator + input.path).replace(/\\/g, '/')
        assert.deepStrictEqual(normalizedResult, normalizedInput)
      })
    }
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
      assertDeepEqualInAnyOrder(Array.from(latest), [
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
      assertDeepEqualInAnyOrder(Array.from(latest), [
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
      assertDeepEqualInAnyOrder(Array.from(latest), [
        'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/30.3.0.json'
      ])
    })

    it('should ignore invalid semver, invalid sermver first', () => {
      const latest = AbstractFileStore.getLatestToolPaths([
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'
      ])
      assertDeepEqualInAnyOrder(Array.from(latest), ['npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'])
    })

    it('should ignore invalid semver, invalid sermver last', () => {
      const latest = AbstractFileStore.getLatestToolPaths([
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
      ])
      assertDeepEqualInAnyOrder(Array.from(latest), ['npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.1.json'])
    })

    it('should return at least the first tool version', () => {
      const latest = AbstractFileStore.getLatestToolPaths([
        'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
      ])
      assertDeepEqualInAnyOrder(Array.from(latest), [
        'npm/npmjs/-/debug/revision/3.1.0/tool/clearlydefined/1.5.0.json',
        'npm/npmjs/-/debug/revision/3.1.0/tool/scancode/2.9.0b1.json'
      ])
    })
  })

  describe('find(query)', () => {
    let FileStore
    let fileStore

    const sampleEntries = [
      {
        path: '/foo/npm/npmjs/-/test/revision/1.0/tool/toolA/1.0.json',
        meta: 'a',
        coordinates: new EntityCoordinates('npm', 'npmjs', null, 'test', '1.0'),
        licensed: { declared: 'MIT', score: { total: 90 } },
        described: { releaseDate: '2023-01-01', score: { total: 80 } }
      },
      {
        path: '/foo/npm/npmjs/-/test/revision/2.0/tool/toolB/2.0.json',
        meta: 'b',
        coordinates: new EntityCoordinates('npm', 'npmjs', null, 'test', '2.0'),
        licensed: { declared: 'Apache-2.0', score: { total: 70 } },
        described: { releaseDate: '2024-01-01', score: { total: 85 } }
      },
      {
        path: '/foo/npm/npmjs/-/test/revision/2.0/tool/toolC/3.0.json',
        meta: 'c',
        coordinates: new EntityCoordinates('npm', 'npmjs', null, 'test', '2.0'),
        licensed: { declared: 'GPL', score: { total: 50 } },
        described: { releaseDate: '2022-01-01', score: { total: 90 } }
      }
    ]

    beforeEach(() => {
      FileStore = proxyquire('../../../providers/stores/abstractFileStore', {
        'recursive-readdir': async path =>
          Object.keys({
            '/foo/npm/npmjs/-/test/revision/1.0/tool/toolA/1.0.json': {},
            '/foo/npm/npmjs/-/test/revision/2.0/tool/toolB/2.0.json': {},
            '/foo/npm/npmjs/-/test/revision/2.0/tool/toolC/3.0.json': {}
          }).filter(p => p.startsWith(path)),
        'node:fs': {
          readFile: (path, cb) => {
            const entry = sampleEntries.find(e => e.path === path)
            if (entry) {
              cb(null, JSON.stringify(entry))
            } else {
              cb(new Error('Not found'))
            }
          }
        }
      })

      fileStore = new FileStore({ location: '/foo', logger })
    })
    it('returns matching entries based on query filter', async () => {
      const query = {
        type: 'npm',
        provider: 'npmjs',
        name: 'test'
      }
      const results = await fileStore.find(query)

      const filteredResults = results.filter(entry => entry && (entry.meta === 'b' || entry.meta === 'c'))

      assert.ok(Array.isArray(filteredResults))
      assert.strictEqual(filteredResults.length, 2)
      assert.deepStrictEqual(new Set(filteredResults.map(r => r.meta)), new Set(['b', 'c']))
    })

    it('returns empty array if no entries match the query', async () => {
      const noMatchQuery = {
        name: 'non-existent-name'
      }
      const results = await fileStore.find(noMatchQuery)
      assert.ok(Array.isArray(results))
      assert.strictEqual(results.length, 0)
    })

    it('filters by license declared', async () => {
      const query = { license: 'MIT' }
      const results = await fileStore.find(query)
      assert.strictEqual(results.length, 1)
      assert.strictEqual(results[0].meta, 'a')
    })

    it('filters by releasedAfter date', async () => {
      const query = { releasedAfter: '2023-06-01' }
      const results = await fileStore.find(query)
      assert.deepStrictEqual(new Set(results.map(r => r.meta)), new Set(['b']))
    })

    it('filters by minLicensedScore', async () => {
      const query = { minLicensedScore: 60 }
      const results = await fileStore.find(query)
      assert.deepStrictEqual(new Set(results.map(r => r.meta)), new Set(['a', 'b']))
    })

    it('filters by combined criteria', async () => {
      const query = { provider: 'npmjs', minDescribedScore: 85 }
      const results = await fileStore.find(query)
      assert.deepStrictEqual(new Set(results.map(r => r.meta)), new Set(['b', 'c']))
    })
  })
})
