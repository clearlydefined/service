// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { assert } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()
const httpMocks = require('node-mocks-http')
const requestPromiseStub = sinon.stub()
const originCondaRoutes = require('../../routes/originConda')

const fetchModuleStub = {
  callFetch: requestPromiseStub
}
const createCondaRepoAccess = proxyquire('../../lib/condaRepoAccess', {
  './fetch': fetchModuleStub
})

const channelData = {
  packages: {
    'sample-package': { subdirs: ['linux-64'] },
    'another-package': {},
    'sample-lib': {},
    tensorflow: { subdirs: ['linux-64'] }
  },
  subdirs: ['linux-64']
}

const repoData = {
  packages: {
    'pkg-1': { name: 'sample-package', version: '1.0', build: '0' },
    'pkg-2': { name: 'tensorflow', version: '2.15.0', build: 'cuda120py39hb94c71b_3' }
  }
}

describe('CondaRepoAccess', () => {
  let condaRepoAccess
  let cacheMock

  beforeEach(() => {
    cacheMock = {
      get: sinon.stub(),
      set: sinon.stub()
    }

    condaRepoAccess = createCondaRepoAccess(cacheMock)
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
        assert.strictEqual(error.message, 'Unrecognized Conda channel unknown-channel')
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
        assert.strictEqual(error.message, 'Package non-existent-package not found in channel conda-forge')
      }
    })

    it('should throw an error if subdir is not found in channel data', async () => {
      requestPromiseStub.resolves(channelData)
      cacheMock.get.returns(null)

      try {
        await condaRepoAccess.getRevisions('conda-forge', 'linux-641', 'sample-package')
        assert.fail('Expected error was not thrown')
      } catch (error) {
        assert.strictEqual(error.message, 'Subdir linux-641 is non-existent in channel conda-forge, subdirs: linux-64')
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

  describe('Conda Origin Routes', () => {
    it('handles a valid GET request for revisions', async () => {
      requestPromiseStub.onFirstCall().resolves(channelData)
      requestPromiseStub.onSecondCall().resolves(repoData)
      const request = createGetOriginCondaRevisionsRequest('tensorflow')
      const response = httpMocks.createResponse()

      const router = initializeRoutes()
      await router._getOriginCondaRevisions(request, response)
      assert.strictEqual(response.statusCode, 200)
      assert.deepEqual(response._getData(), ['linux-64:2.15.0-cuda120py39hb94c71b_3'])
      assert.isTrue(requestPromiseStub.calledTwice)
    })

    it('handles a valid GET request for package listings', async () => {
      requestPromiseStub.onFirstCall().resolves(channelData)
      const request = createGetOriginCondaRequest('conda-forge')
      const response = httpMocks.createResponse()

      const router = initializeRoutes()
      await router._getOriginConda(request, response)
      assert.strictEqual(response.statusCode, 200)
      assert.deepEqual(response._getData(), [{ id: 'tensorflow' }])
      assert.isTrue(requestPromiseStub.called)
    })

    it('returns a 404 error for a non-existent channel', async () => {
      requestPromiseStub.onFirstCall().resolves(channelData)
      const request = createGetOriginCondaRequest('tensor')
      const response = httpMocks.createResponse()

      const router = initializeRoutes()
      await router._getOriginConda(request, response)
      assert.strictEqual(response.statusCode, 404)
      assert.strictEqual(response._getData(), 'Unrecognized Conda channel tensor')
    })

    it('returns a 404 error for a non-existent package in revisions', async () => {
      requestPromiseStub.onFirstCall().resolves(channelData)
      requestPromiseStub.onSecondCall().resolves(repoData)
      const request = createGetOriginCondaRevisionsRequest('tensorflow1212')
      const response = httpMocks.createResponse()

      const router = initializeRoutes()
      await router._getOriginCondaRevisions(request, response)
      assert.strictEqual(response.statusCode, 404)
      assert.strictEqual(response._getData(), 'Package tensorflow1212 not found in channel conda-forge')
      assert.isTrue(requestPromiseStub.calledOnce)
    })

    function createGetOriginCondaRevisionsRequest(name) {
      return httpMocks.createRequest({
        method: 'GET',
        url: `/origins/conda/'conda-forge'/linux-64/${name}/revisions`,
        baseUrl: 'https://dev.clearlydefined.io',
        params: {
          channel: 'conda-forge',
          subdir: 'linux-64',
          name: name
        }
      })
    }

    function createGetOriginCondaRequest(channel) {
      return httpMocks.createRequest({
        method: 'GET',
        url: `/origins/conda/${channel}/tensorflow/`,
        baseUrl: 'https://dev.clearlydefined.io',
        params: {
          channel: channel,
          name: 'tensorflow'
        }
      })
    }

    function initializeRoutes() {
      return originCondaRoutes(condaRepoAccess, true)
    }
  })
})
