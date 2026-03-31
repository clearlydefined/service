// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { CondaChannelData, CondaRepoData } from '../../lib/condaRepoAccess.js'
import type { ICache } from '../../providers/caching/index.js'

const proxyquire = require('proxyquire').noCallThru()
const requestPromiseStub = mock.fn()

const createCondaRepoAccess: (cache?: ICache) => ReturnType<typeof import('../../lib/condaRepoAccess.js')> = proxyquire(
  '../../lib/condaRepoAccess',
  {
    './fetch': { callFetch: requestPromiseStub }
  }
)

const channelData: CondaChannelData = {
  packages: {
    'sample-package': { subdirs: ['linux-64'] },
    'another-package': {},
    'sample-lib': {}
  },
  subdirs: ['linux-64']
}

const repoData: CondaRepoData = {
  packages: {
    'pkg-1': { name: 'sample-package', version: '1.0', build: '0' }
  }
}

describe('CondaRepoAccess', () => {
  let condaRepoAccess: ReturnType<typeof createCondaRepoAccess>
  let cacheMock: { get: ReturnType<typeof mock.fn>; set: ReturnType<typeof mock.fn> }

  beforeEach(() => {
    cacheMock = {
      get: mock.fn(),
      set: mock.fn()
    }

    condaRepoAccess = createCondaRepoAccess(cacheMock as unknown as ICache)
  })

  afterEach(() => {
    requestPromiseStub.mock.resetCalls()
  })

  describe('checkIfValidChannel', () => {
    it('should throw an error for an unrecognized channel', async () => {
      try {
        condaRepoAccess.checkIfValidChannel('unknown-channel')
        assert.fail('Expected error was not thrown')
      } catch (error) {
        assert.strictEqual((error as Error).message, 'Unrecognized Conda channel unknown-channel')
      }
    })

    it('should not throw an error for a recognized channel', async () => {
      condaRepoAccess.checkIfValidChannel('conda-forge')
    })
  })

  describe('fetchChannelData', () => {
    it('should fetch channel data from the cache if available', async () => {
      cacheMock.get.mock.mockImplementation(() => channelData)

      const result = await condaRepoAccess.fetchChannelData('conda-forge')
      assert.strictEqual(result, channelData)
      assert.strictEqual(requestPromiseStub.mock.callCount(), 0)
    })

    it('should fetch channel data from the network if not cached', async () => {
      requestPromiseStub.mock.mockImplementation(async () => channelData)
      cacheMock.get.mock.mockImplementation(() => null)

      const result = await condaRepoAccess.fetchChannelData('conda-forge')
      assert.strictEqual(result, channelData)
      assert.strictEqual(requestPromiseStub.mock.callCount(), 1)
      assert.deepStrictEqual(requestPromiseStub.mock.calls[0].arguments[0], {
        url: 'https://conda.anaconda.org/conda-forge/channeldata.json',
        method: 'GET',
        json: true
      })
    })
  })

  describe('fetchRepoData', () => {
    it('should fetch repo data from the cache if available', async () => {
      cacheMock.get.mock.mockImplementation(() => channelData)

      const result = await condaRepoAccess.fetchRepoData('conda-forge', 'linux-64')
      assert.strictEqual(result, channelData)
      assert.strictEqual(requestPromiseStub.mock.callCount(), 0)
    })

    it('should fetch repo data from the network if not cached', async () => {
      requestPromiseStub.mock.mockImplementation(async () => channelData)
      cacheMock.get.mock.mockImplementation(() => null)

      const result = await condaRepoAccess.fetchRepoData('conda-forge', 'linux-64')
      assert.strictEqual(result, channelData)
      assert.strictEqual(requestPromiseStub.mock.callCount(), 1)
      assert.deepStrictEqual(requestPromiseStub.mock.calls[0].arguments[0], {
        url: 'https://conda.anaconda.org/conda-forge/linux-64/repodata.json',
        method: 'GET',
        json: true
      })
    })
  })

  describe('getRevisions', () => {
    it('should throw an error if package is not found', async () => {
      requestPromiseStub.mock.mockImplementation(async () => channelData)
      cacheMock.get.mock.mockImplementation(() => null)

      try {
        await condaRepoAccess.getRevisions('conda-forge', 'linux-64', 'non-existent-package')
        assert.fail('Expected error was not thrown')
      } catch (error) {
        assert.strictEqual((error as Error).message, 'Package non-existent-package not found in channel conda-forge')
      }
    })

    it('should throw an error if subdir is not found in channel data', async () => {
      requestPromiseStub.mock.mockImplementation(async () => channelData)
      cacheMock.get.mock.mockImplementation(() => null)

      try {
        await condaRepoAccess.getRevisions('conda-forge', 'linux-641', 'sample-package')
        assert.fail('Expected error was not thrown')
      } catch (error) {
        assert.strictEqual(
          (error as Error).message,
          'Subdir linux-641 is non-existent in channel conda-forge, subdirs: linux-64'
        )
      }
    })

    it('should return revisions for a valid package', async () => {
      let callCount = 0
      requestPromiseStub.mock.mockImplementation(async () => {
        callCount++
        return callCount === 1 ? channelData : repoData
      })

      cacheMock.get.mock.mockImplementation(() => null)

      const revisions = await condaRepoAccess.getRevisions('conda-forge', 'linux-64', 'sample-package')
      assert.deepStrictEqual(revisions, ['linux-64:1.0-0'])
    })
  })

  describe('getPackages', () => {
    it('should return matching packages', async () => {
      requestPromiseStub.mock.resetCalls()
      requestPromiseStub.mock.mockImplementation(async () => channelData)
      cacheMock.get.mock.mockImplementation(() => null)

      const matches = await condaRepoAccess.getPackages('conda-forge', 'sample')
      assert.deepStrictEqual(matches, [{ id: 'sample-package' }, { id: 'sample-lib' }])
    })
  })
})
