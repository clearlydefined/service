// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
chai.use(deepEqualInAnyOrder)
const expect = chai.expect
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
    expect(result).to.deep.equalInAnyOrder(expected)
  })

  it('lists multiple results', async () => {
    const fileStore = FileStore()
    const result = await fileStore.list(new EntityCoordinates('npm', 'npmjs', null, 'test', '2.0'), 'result')
    const expected = [
      'npm/npmjs/-/test/2.0/testtool0/1.0',
      'npm/npmjs/-/test/2.0/testtool1/2.0',
      'npm/npmjs/-/test/2.0/testtool2/3.0'
    ]
    expect(result).to.deep.equalInAnyOrder(expected)
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
    expect(tools.length).to.eq(5)
    const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
    expect(clearlydefinedVersions).to.deep.equalInAnyOrder(['1', '1.1.2', '1.3.4'])
    const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
    expect(scancodeVersions).to.deep.equalInAnyOrder(['2.2.1', '2.9.0+b1', '30.3.0'])
    const licenseeVersions = Object.getOwnPropertyNames(result.licensee)
    expect(licenseeVersions).to.deep.equalInAnyOrder(['9.12.1', '9.14.0'])
    const reuseVersions = Object.getOwnPropertyNames(result.reuse)
    expect(reuseVersions).to.deep.equalInAnyOrder(['1.3.0', '3.2.1'])
    const fossologyVersions = Object.getOwnPropertyNames(result.fossology)
    expect(fossologyVersions).to.deep.equalInAnyOrder(['3.3.0', '3.6.0'])
  })

  it('should return all latest harvest results', async () => {
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/debug/3.1.0')
    const result = await fileStore.getAllLatest(coordinates)
    const tools = Object.getOwnPropertyNames(result)
    expect(tools.length).to.eq(5)
    const clearlydefinedVersions = Object.getOwnPropertyNames(result.clearlydefined)
    expect(clearlydefinedVersions).to.deep.equalInAnyOrder(['1.3.4'])
    const scancodeVersions = Object.getOwnPropertyNames(result.scancode)
    expect(scancodeVersions).to.deep.equalInAnyOrder(['30.3.0'])
    const licenseeVersions = Object.getOwnPropertyNames(result.licensee)
    expect(licenseeVersions).to.deep.equalInAnyOrder(['9.14.0'])
    const reuseVersions = Object.getOwnPropertyNames(result.reuse)
    expect(reuseVersions).to.deep.equalInAnyOrder(['3.2.1'])
    const fossologyVersions = Object.getOwnPropertyNames(result.fossology)
    expect(fossologyVersions).to.deep.equalInAnyOrder(['3.6.0'])
  })

  it('should get latest files', () => {
    const result = fileStore._getListOfLatestFiles(allFiles)
    expect(result.length).to.eq(4)
    expect(Array.from(result)).to.deep.equalInAnyOrder([
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/clearlydefined/1.4.1.json',
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/licensee/9.18.1.json',
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/reuse/3.2.2.json',
      '/tmp/harvested_data/pypi/pypi/-/platformdirs/revision/4.2.0/tool/scancode/32.3.0.json'
    ])
  })

  it('should handle error', () => {
    fileStore._getLatestToolVersions = sinon.stub().throws(new Error('test error'))
    fileStore.logger.error = sinon.stub()
    const result = fileStore._getListOfLatestFiles(allFiles)
    expect(fileStore.logger.error.calledOnce).to.be.true
    expect(result.length).to.eq(allFiles.length)
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
