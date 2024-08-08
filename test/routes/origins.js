// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')
const originCondaRoutes = require('../../routes/originConda')
const proxyquire = require('proxyquire')
const fs = require('fs')

describe('Pypi origin routes', () => {
  let Fetch
  const fixturePath = 'test/fixtures/origins/pypi'
  beforeEach(() => {
    const requestPromiseStub = options => {
      //Splitting url to extract the package name searched
      const name = options.url.split('/')[4]
      if (name === 'pan') throw { message: { body: 'Internal server Error', statusCode: 500 } }
      if (name === 'pand') throw { body: { message: 'Not Found' }, statusCode: 404 }
      const body = loadFixture(`${fixturePath}/${name}.json`)
      if (name === 'pandas') return { body, statusCode: 200 }
    }
    Fetch = proxyquire('../../routes/originPyPi', { 'request-promise-native': requestPromiseStub })
  })

  afterEach(function () {
    sinon.restore()
  })

  it('should return a valid response when a valid package is provided as input', async () => {
    const router = Fetch(true)
    const response = await router._getPypiData('pandas')
    expect(response.body.info.name).to.be.equal('pandas')
  })
  it('should return an empty response when a missing package is provided as input', async () => {
    const router = Fetch(true)
    expect(await router._getPypiData('pand')).to.be.deep.equal([])
  })
  it('should return a valid error message when an error other than 404 occurs', async () => {
    const router = Fetch(true)
    await router._getPypiData('pan').catch(error => expect(error.statusCode).to.be.equal(500))
  })
})

function loadFixture(path) {
  const body = fs.readFileSync(path)
  return JSON.parse(body)
}

describe('Conda origin routes', () => {
  it('accepts a good revisions GET request', async () => {
    const request = createGetOriginCondaRevisionsRequest()
    const response = httpMocks.createResponse()
    const stubCondaCache = createStubCondaCache({
      'conda-forge-linux-64-repoData': {
        packages: [
          {
            name: 'tensorflow',
            version: '2.15.0',
            build: 'cuda120py39hb94c71b_3'
          }
        ],
        subdirs: ['linux-64']
      },
      'conda-forge-channelData': {
        packages: {
          tensorflow: {}
        },
        subdirs: ['linux-64']
      }
    })
    const router = createRoutes(stubCondaCache)
    await router._getOriginCondaRevisions(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(response._getData()).to.be.deep.equal(['linux-64:2.15.0-cuda120py39hb94c71b_3'])
    expect(stubCondaCache.get.calledTwice).to.be.true
  })
})

function createGetOriginCondaRevisionsRequest() {
  return httpMocks.createRequest({
    method: 'GET',
    url: 'origins/conda/conda-forge/linux-64/tensorflow/revisions',
    baseUrl: 'https://dev.clearlydefined.io',
    params: {
      channel: 'conda-forge',
      subdir: 'linux-64',
      name: 'tensorflow'
    }
  })
}

function createRoutes(condaCache) {
  return originCondaRoutes(condaCache, true)
}

function createStubCondaCache(cacheData) {
  let getStub = sinon.stub()

  for (const [key, value] of Object.entries(cacheData)) {
    getStub.withArgs(key).returns(value)
  }

  return {
    get: getStub
  }
}
