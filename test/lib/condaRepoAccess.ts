// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { assert } from 'chai'
import esmock from 'esmock'
import type { SinonStub } from 'sinon'
import sinon from 'sinon'
import type { CondaChannelData, CondaRepoData } from '../../lib/condaRepoAccess.ts'
import type { ICache } from '../../providers/caching/index.js'

const requestPromiseStub: SinonStub = sinon.stub()

const fetchModuleStub = {
  callFetch: requestPromiseStub
}

const createCondaRepoAccess: (cache?: ICache) => ReturnType<typeof import('../../lib/condaRepoAccess.ts')['default']> =
  await esmock.strict('../../lib/condaRepoAccess.ts', {
    '../../lib/fetch.ts': fetchModuleStub
  })

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
  let cacheMock: { get: sinon.SinonStub; set: sinon.SinonStub }

  beforeEach(() => {
    cacheMock = {
      get: sinon.stub(),
      set: sinon.stub()
    }

    condaRepoAccess = createCondaRepoAccess(cacheMock as unknown as ICache)
  })

  afterEach(() => {
    sinon.restore()
    requestPromiseStub.resetHistory()
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
      cacheMock.get.returns(channelData)

      const result = await condaRepoAccess.fetchChannelData('conda-forge')
      assert.strictEqual(result, channelData)
      assert.isFalse(requestPromiseStub.called)
    })

    it('should fetch channel data from the network if not cached', async () => {
      requestPromiseStub.resolves(channelData)
      cacheMock.get.returns(null)

      const result = await condaRepoAccess.fetchChannelData('conda-forge')
      assert.strictEqual(result, channelData)
      assert.isTrue(
        requestPromiseStub.calledOnceWith({
          url: 'https://conda.anaconda.org/conda-forge/channeldata.json',
          method: 'GET',
          json: true
        })
      )
    })
  })

  describe('fetchRepoData', () => {
    it('should fetch repo data from the cache if available', async () => {
      cacheMock.get.returns(channelData)

      const result = await condaRepoAccess.fetchRepoData('conda-forge', 'linux-64')
      assert.strictEqual(result, channelData)
      assert.isFalse(requestPromiseStub.called)
    })

    it('should fetch repo data from the network if not cached', async () => {
      requestPromiseStub.resolves(channelData)
      cacheMock.get.returns(null)

      const result = await condaRepoAccess.fetchRepoData('conda-forge', 'linux-64')
      assert.strictEqual(result, channelData)
      assert.isTrue(
        requestPromiseStub.calledOnceWith({
          url: 'https://conda.anaconda.org/conda-forge/linux-64/repodata.json',
          method: 'GET',
          json: true
        })
      )
    })
  })

  describe('getRevisions', () => {
    it('should throw an error if package is not found', async () => {
      requestPromiseStub.resolves(channelData)
      cacheMock.get.returns(null)

      try {
        await condaRepoAccess.getRevisions('conda-forge', 'linux-64', 'non-existent-package')
        assert.fail('Expected error was not thrown')
      } catch (error) {
        assert.strictEqual((error as Error).message, 'Package non-existent-package not found in channel conda-forge')
      }
    })

    it('should throw an error if subdir is not found in channel data', async () => {
      requestPromiseStub.resolves(channelData)
      cacheMock.get.returns(null)

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
      requestPromiseStub.onFirstCall().resolves(channelData)
      requestPromiseStub.onSecondCall().resolves(repoData)

      cacheMock.get.returns(null)

      const revisions = await condaRepoAccess.getRevisions('conda-forge', 'linux-64', 'sample-package')
      assert.deepEqual(revisions, ['linux-64:1.0-0'])
    })
  })

  describe('getPackages', () => {
    it('should return matching packages', async () => {
      requestPromiseStub.reset()
      requestPromiseStub.resolves(channelData)
      cacheMock.get.returns(null)

      const matches = await condaRepoAccess.getPackages('conda-forge', 'sample')
      assert.deepEqual(matches, [{ id: 'sample-package' }, { id: 'sample-lib' }])
    })
  })
})
