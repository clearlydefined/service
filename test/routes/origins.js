// @ts-nocheck
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect, assert } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const fs = require('fs')
const httpMocks = require('node-mocks-http')
const originMavenRoutes = require('../../routes/originMaven')
const originCondaRoutes = require('../../routes/originConda')

describe('Pypi origin routes', () => {
  let router
  let requestPromiseStub
  const fixturePath = 'test/fixtures/origins/pypi'
  beforeEach(() => {
    requestPromiseStub = sinon.stub()
    const createRoute = proxyquire('../../routes/originPyPi', { '../lib/fetch': { callFetch: requestPromiseStub } })
    router = createRoute(true)
  })

  afterEach(function () {
    sinon.restore()
  })

  it('should return a valid response when a valid package is provided as input', async () => {
    requestPromiseStub.returns({ body: loadFixture(`${fixturePath}/pandas.json`), statusCode: 200 })
    const response = await router._getPypiData('pandas')
    expect(response.body.info.name).to.be.equal('pandas')
  })

  it('should return an empty response when a missing package is provided as input', async () => {
    requestPromiseStub.throws({ body: { message: 'Not Found' }, statusCode: 404 })
    expect(await router._getPypiData('pand')).to.be.deep.equal({})
  })

  it('should return a valid error message when an error other than 404 occurs', async () => {
    requestPromiseStub.throws({ statusCode: 400 })
    try {
      await router._getPypiData('pand')
    } catch (error) {
      expect(error.statusCode).to.be.equal(400)
      return
    }
    //Fail the test case if the error is not thrown
    assert.fail('Error should have been thrown')
  })
})

describe('Maven Origin routes', () => {
  let router
  const fixturePath = 'test/fixtures/origins/maven'

  before(() => {
    router = originMavenRoutes(true)
  })

  it('should return suggestions when incomplete group id is provided as input', async () => {
    const partialGroupId = 'org.apache.httpcom'
    expect(getResponse(partialGroupId)).to.be.deep.equal([
      'httpcore',
      'httpconn',
      'httpcodec',
      'httpcommons',
      'httprox'
    ])
  })

  it('should return list of artefacts when complete group id is provided as input', async () => {
    const completeGroupId = 'org.apache.httpcomponents'
    expect(getResponse(completeGroupId)).to.be.deep.equal(
      loadFixture(`${fixturePath}/${completeGroupId}-response.json`)
    )
  })

  it('should return blank response when group id is invalid and suggestions are not present', async () => {
    const invalidGroupId = '12345'
    expect(getResponse(invalidGroupId)).to.be.deep.equal([])
  })

  it('should return blank response when group id and artefact id are invalid and suggestions are not present', async () => {
    const invalidGroupId = '12345'
    const invalidArtifactId = '1234'
    const responseFilePath = loadFixture(`${fixturePath}/${invalidGroupId}-${invalidArtifactId}.json`)
    expect(router._getSuggestions(responseFilePath, invalidGroupId)).to.be.deep.equal([])
  })

  function getResponse(filename) {
    return router._getSuggestions(loadFixture(`${fixturePath}/${filename}.json`))
  }
})

describe('Conda Origin Routes', () => {
  let condaRepoAccess
  let cacheMock

  const requestPromiseStub = sinon.stub()
  const fetchModuleStub = {
    callFetch: requestPromiseStub
  }

  const createCondaRepoAccess = proxyquire('../../lib/condaRepoAccess', {
    './fetch': fetchModuleStub
  })

  const channelData = {
    packages: {
      tensorflow: { subdirs: ['linux-64'] }
    },
    subdirs: ['linux-64']
  }

  const repoData = {
    packages: {
      'pkg-2': { name: 'tensorflow', version: '2.15.0', build: 'cuda120py39hb94c71b_3' }
    }
  }

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

function loadFixture(path) {
  const body = fs.readFileSync(path)
  return JSON.parse(body)
}
