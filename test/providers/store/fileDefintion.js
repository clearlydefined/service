// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const { expect } = require('chai')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const AbstractFileStore = require('../../../providers/stores/abstractFileStore')
const FileStore = require('../../../providers/stores/fileDefinitionStore')

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
    sinon.stub(AbstractFileStore.prototype, 'list').callsFake(async (coordinates, visitor) => {
      const path = coordinates.toString()
      if (path.includes('error')) throw new Error('test error')
      return Object.keys(data)
        .map(key => (key.startsWith(path) ? visitor(data[key]) : null))
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
      expect(error.message).to.eq('test error')
    }
  })

  it('works for unknown path coordinates ', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'bogus', '0.0'))
    expect(result.length).to.eq(0)
  })

  it('lists zero definitions', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '0.0'))
    expect(result.length).to.eq(0)
  })

  it('list a single definition', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '1.0'))
    const expected = ['npm/npmjs/-/test/1.0']
    expect(result).to.deep.equalInAnyOrder(expected)
  })

  it('lists multiple definitions ', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test'))
    // Note that revision 0.0 is skipped because it is empty
    const expected = ['npm/npmjs/-/test/1.0', 'npm/npmjs/-/test/2.0']
    expect(result).to.deep.equalInAnyOrder(expected)
  })
})
