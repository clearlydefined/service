import assert from 'node:assert/strict'
import { assertDeepEqualInAnyOrder } from '../../helpers/assert.ts'
import { describe, it, before, after, mock } from 'node:test'
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import EntityCoordinates from '../../../lib/entityCoordinates.js'
import AbstractFileStore from '../../../providers/stores/abstractFileStore.js'
import FileStore from '../../../providers/stores/fileDefinitionStore.js'

const data = {
  'npm/npmjs/-/test/0.0': {},
  'npm/npmjs/-/test/1.0': {
    coordinates: EntityCoordinates.fromUrn('urn:npm:npmjs:-:test:revision:1.0')
  },
  'npm/npmjs/-/test/2.0': {
    coordinates: EntityCoordinates.fromUrn('urn:npm:npmjs:-:test:revision:2.0')
  },
  'npm/npmjs/-/test1/2.0': {
    coordinates: EntityCoordinates.fromUrn('urn:npm:npmjs:-:test:revision:2.0')
  },
  'npm/npmjs/-/test1/3.0': {
    coordinates: EntityCoordinates.fromUrn('urn:npm:npmjs:-:test:revision:2.0')
  }
}

describe('FileDefinitionStore list definitions', () => {
  before(() => {
    mock.method(AbstractFileStore.prototype, 'list', async (coordinates, visitor) => {
      const path = coordinates.toString()
      if (path.includes('error')) {
        throw new Error('test error')
      }
      return Object.keys(data)
        .map(key => (key.startsWith(path) ? visitor(data[key]) : null))
        .filter(e => e)
    })
  })

  after(() => (AbstractFileStore.prototype.list as any).restore())

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

  it('lists zero definitions', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '0.0'))
    assert.strictEqual(result.length, 0)
  })

  it('list a single definition', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '1.0'))
    const expected = ['npm/npmjs/-/test/1.0']
    assertDeepEqualInAnyOrder(result, expected)
  })

  it('lists multiple definitions ', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test'))
    // Note that revision 0.0 is skipped because it is empty
    const expected = ['npm/npmjs/-/test/1.0', 'npm/npmjs/-/test/2.0']
    assertDeepEqualInAnyOrder(result, expected)
  })
})
