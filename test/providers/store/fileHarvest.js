// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const { expect } = require('chai')
const ResultCoordinates = require('../../../lib/resultCoordinates')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const AbstractFileStore = require('../../../providers/stores/abstractFileStore')
const FileStore = require('../../../providers/stores/fileHarvestStore')

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
    sinon.stub(AbstractFileStore.prototype, 'list').callsFake(async (coordinates, visitor) => {
      const path = coordinates.toString()
      if (path.includes('error')) throw new Error('test error')
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
      expect(error.message).to.eq('test error')
    }
  })

  it('works for unknown path coordinates ', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'bogus', '0.0'))
    expect(result.length).to.eq(0)
  })

  it('lists no results', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '0.0'), 'result')
    expect(result.length).to.eq(0)
  })

  it('lists a single result', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '1.0'), 'result')
    const expected = ['npm/npmjs/-/test/1.0/testtool/2.0']
    expect(result).to.equalInAnyOrder(expected)
  })

  it('lists multiple results', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '2.0'), 'result')
    const expected = [
      'npm/npmjs/-/test/2.0/testtool0/1.0',
      'npm/npmjs/-/test/2.0/testtool1/2.0',
      'npm/npmjs/-/test/2.0/testtool2/3.0'
    ]
    expect(result).to.equalInAnyOrder(expected)
  })
})
