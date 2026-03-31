import assert from 'node:assert/strict'
import { assertDeepEqualInAnyOrder } from '../helpers/assert.js'
import { describe, it, before, after, beforeEach, mock } from 'node:test'
// @ts-nocheck
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT



import EntityCoordinates from '../../../lib/entityCoordinates.js'
import AbstractFileStore from '../../../providers/stores/abstractFileStore.js'
import FileStore from '../../../providers/stores/fileHarvestStore.js'

const data = {
  'npm/npmjs/-/test/0.0': {},
  'npm/npmjs/-/test/1.0/tool/testtool/2.0': {
    contents: { _metadata: { links: { self: { href: 'urn:npm:npmjs:-:test:revision:1.0:tool:testtool:2.0' } } } }
  },
  'npm/npmjs/-/test/2.0/tool/testtool0/1.0': {
    contents: { _metadata: { links: { self: { href: 'urn:npm:npmjs:-:test:revision:2.0:tool:testtool0:1.0' } } } }
  },
  'npm/npmjs/-/test/2.0/tool/testtool1/2.0': {
    contents: { _metadata: { links: { self: { href: 'urn:npm:npmjs:-:test:revision:2.0:tool:testtool1:2.0' } } } }
  },
  'npm/npmjs/-/test/2.0/tool/testtool2/3.0': {
    contents: { _metadata: { links: { self: { href: 'urn:npm:npmjs:-:test:revision:2.0:tool:testtool2:3.0' } } } }
  }
}

describe('FileHarvestStore list tool results', () => {
  before(() => {
    mock.method(AbstractFileStore.prototype, 'list').callsFake(async (coordinates, visitor) => {
      const path = coordinates.toString()
      if (path.includes('error')) {
        throw new Error('test error')
      }
      return Object.keys(data)
        .map(key => (key.startsWith(path) ? visitor(data[key].contents) : null))
        .filter(e => e)
    })
  })

  after(() => AbstractFileStore.prototype.list.restore())

  it('throws original error when not ENOENT', async () => {
    const fileStore = FileStore()
    try {
      await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'error', '0.0'))
      throw new Error('should have thrown error')
    } catch (error) {
      assert.strictEqual(error.message, 'test error')
    }
  })

  it('works for unknown path coordinates ', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'bogus', '0.0'))
    assert.strictEqual(result.length, 0)
  })

  it('lists no results', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '0.0'), 'result')
    assert.strictEqual(result.length, 0)
  })

  it('lists a single result', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '1.0'), 'result')
    const expected = ['npm/npmjs/-/test/1.0/testtool/2.0']
    assertDeepEqualInAnyOrder(result, expected)
  })

  it('lists multiple results', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '2.0'), 'result')
    const expected = [
      'npm/npmjs/-/test/2.0/testtool0/1.0',
      'npm/npmjs/-/test/2.0/testtool1/2.0',
      'npm/npmjs/-/test/2.0/testtool2/3.0'
    ]
    assertDeepEqualInAnyOrder(result, expected)
  })
})

describe('getAll and getAllLatest', () => {
  const allFiles = [
    '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/clearlydefined/1.3.1.json',
    '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/clearlydefined/1.4.1.json',
    '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/licensee/9.18.1.json',
    '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/reuse/3.2.1.json',
    '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/reuse/3.2.2.json',
    '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/scancode/30.3.0.json',
    '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/scancode/32.3.0.json'
  ]
  let fileStore

  beforeEach(() => {
    fileStore = createFileHarvestStore()
  })

  it('should return all harvest results', async () => {
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/debug/3.1.0')
    const result = await fileStore.getAll(coordinates)
    const tools = Object.getOwnPropertyNames(result)
    assert.strictEqual(tools.length, 5)
    const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
    assertDeepEqualInAnyOrder(clearlydefinedVersions, ['1', '1.1.2', '1.3.4'])
    const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
    assertDeepEqualInAnyOrder(scancodeVersions, ['2.2.1', '2.9.0+b1', '30.3.0'])
    const licenseeVersions = Object.getOwnPropertyNames(result.licensee)
    assertDeepEqualInAnyOrder(licenseeVersions, ['9.12.1', '9.14.0'])
    const reuseVersions = Object.getOwnPropertyNames(result.reuse)
    assertDeepEqualInAnyOrder(reuseVersions, ['1.3.0', '3.2.1'])
    const fossologyVersions = Object.getOwnPropertyNames(result.fossology)
    assertDeepEqualInAnyOrder(fossologyVersions, ['3.3.0', '3.6.0'])
  })

  it('should return all latest harvest results', async () => {
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/debug/3.1.0')
    const result = await fileStore.getAllLatest(coordinates)
    const tools = Object.getOwnPropertyNames(result)
    assert.strictEqual(tools.length, 5)
    const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
    assertDeepEqualInAnyOrder(clearlydefinedVersions, ['1.3.4'])
    const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
    assertDeepEqualInAnyOrder(scancodeVersions, ['30.3.0'])
    const licenseeVersions = Object.getOwnPropertyNames(result.licensee)
    assertDeepEqualInAnyOrder(licenseeVersions, ['9.14.0'])
    const reuseVersions = Object.getOwnPropertyNames(result.reuse)
    assertDeepEqualInAnyOrder(reuseVersions, ['3.2.1'])
    const fossologyVersions = Object.getOwnPropertyNames(result.fossology)
    assertDeepEqualInAnyOrder(fossologyVersions, ['3.6.0'])
  })

  it('should get latest files', () => {
    const result = fileStore._getListOfLatestFiles(allFiles)
    assert.strictEqual(result.length, 4)
    assertDeepEqualInAnyOrder(Array.from(result), [
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/clearlydefined/1.4.1.json',
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/licensee/9.18.1.json',
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/reuse/3.2.2.json',
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/scancode/32.3.0.json'
    ])  })

  it('should handle error', () => {
    fileStore._getLatestToolVersions = mock.fn().throws(new Error('test error'))
    fileStore.logger.error = mock.fn()
    const result = fileStore._getListOfLatestFiles(allFiles)
    assert.strictEqual(fileStore.logger.error.mock.callCount() === 1, true)
    assert.strictEqual(result.length, allFiles.length)
    expect(Array.from(result)).to.deep.equalInAnyOrder(allFiles)
  })
})

function createFileHarvestStore() {
  const options = {
    location: 'test/fixtures/store',
    logger: {
      error: () => {},
      debug: () => {}
    }
  }
  return FileStore(options)
}
