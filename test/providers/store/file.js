// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const fs = require('fs')
const assert = require('assert')
const FileStore = require('../../../providers/stores/file')
const ResultCoordinates = require('../../../lib/resultCoordinates')
const EntityCoordinates = require('../../../lib/entityCoordinates')

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
    path: 'npm/npmjs/namespace/name/revision/1.0/tool/testTool/2.0',
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

describe('path to coordinates mapping', () => {
  data.forEach(input => {
    it('works well for ' + input.path, () => {
      const fileStore = FileStore({ location: input.location })
      const separator = input.location.includes('/') ? '/' : '\\'
      const result = fileStore._toResultCoordinatesFromStoragePath(input.location + separator + input.path)
      assert.deepEqual(result, input.coordinates)
    })
  })
})

describe('coordinates to path mapping', () => {
  data.forEach(input => {
    it('works well for ' + input.path, () => {
      const fileStore = FileStore({ location: input.location })
      const result = fileStore._toStoragePathFromCoordinates(input.coordinates)
      const separator = input.location.includes('/') ? '/' : '\\'
      // account for platform differences in path separator.
      const normalizedResult = result.replace(/\\/g, '/')
      // TODO We expect much of the path to be lowercased however the approach below requires ALL
      // of the path to be lowercased. unclear if case variation on namespace, name and revision is ok.
      const normalizedInput = (input.location + separator + input.path).replace(/\\/g, '/').toLowerCase()
      assert.deepEqual(normalizedResult, normalizedInput)
    })
  })
})

describe('get a tool result ', () => {
  beforeEach(function() {
    sandbox.stub(fs, 'readFile').yields(null, '{"test": "file"}')
    const readdirStub = path => {
      path = path.replace(/\\/g, '/')
      const result = [
        '/foo/npm/npmjs/-/test/revision/0.0',
        '/foo/npm/npmjs/-/test/revision/1.0/tool/testTool/2.0.json',
        '/foo/npm/npmjs/-/test/revision/2.0/tool/testTool0/1.0.json',
        '/foo/npm/npmjs/-/test/revision/2.0/tool/testTool1/2.0.json',
        '/foo/npm/npmjs/-/test/revision/2.0/tool/testTool2/3.0.json'
      ].filter(p => p.startsWith(path))
      if (result.length === 0) {
        const error = new Error('test')
        error.code = 'ENOENT'
        throw error
      }
      return result.filter(p => p !== path)
    }

    sandbox.stub(fs, 'readdir').callsFake(readdirStub)
  })

  afterEach(function() {
    sandbox.restore()
  })

  it('works well for a specific tool version', async () => {
    const fileStore = FileStore({ location: '/foo' })
    const result = await fileStore.get(new ResultCoordinates('npm', 'npmjs', null, 'test', '1.0', 'testtool', '2.0'))
    assert.equal(result.test, 'file')
  })
})

const toolData = [
  {
    location: linux,
    paths: [
      'npm/npmjs/namespace/name/revision/1.0/tool/testTool0/2.0',
      'npm/npmjs/-/name/revision/1.0/tool/testTool1/3.0'
    ],
    coordinates: [
      ['npm', 'npmjs', 'namespace', 'name', '1.0', 'testtool0', '2.0'],
      ['npm', 'npmjs', null, 'name', '1.0', 'testtool1', '3.0']
    ]
  },
  {
    location: linux,
    paths: ['npm/npmjs/namespace/name/revision/1.0/tool/testTool/2.0.json'],
    coordinates: [['npm', 'npmjs', 'namespace', 'name', '1.0', 'testtool', '2.0']]
  }
]

describe('FileStore listing content ', () => {
  toolData.forEach((input, index) => {
    it('works for well structured entity data: ' + index, async () => {
      const fileStore = FileStore({ location: input.location })
      fileStore._list = () => input.paths.map(path => input.location + '/' + path)
      const list = await fileStore.list('dummy')
      list.forEach((item, index) => {
        const expectedCoordinates = new EntityCoordinates(...input.coordinates[index])
        assert.deepEqual(item, expectedCoordinates)
      })
    })

    it('works for well structured resuilt data: ' + index, async () => {
      const fileStore = FileStore({ location: input.location })
      fileStore._list = () => input.paths.map(path => input.location + '/' + path)
      const list = await fileStore.list('dummy', 'result')
      list.forEach((item, index) => {
        const expectedCoordinates = new ResultCoordinates(...input.coordinates[index])
        assert.deepEqual(item, expectedCoordinates)
      })
    })
  })
})
