// @ts-nocheck
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')
const originCondaRoutes = require('../../routes/originConda')
const originMavenRoutes = require('../../routes/originMaven')
const fs = require('fs')

describe('Maven Origin routes', () => {
  let router
  before(() => {
    router = originMavenRoutes(true)
  })

  it('should return suggestions when incomplete group id is provided as input', async () => {
    const groupId = 'org.apache.httpcom'
    expect(getResponse(groupId)).to.be.deep.equal(['httpcore', 'httpconn', 'httpcodec', 'httpcommons', 'httprox'])
  })

  it('should not return suggestions when complete group id is provided as input', async () => {
    const groupId = 'org.apache.httpcomponents'
    expect(getResponse(groupId)).to.be.deep.equal(getResponse(`${groupId}-response`))
  })

  it('should return blank response when suggestions are not present', async () => {
    const groupId = '12345'
    expect(getResponse(groupId)).to.be.deep.equal([])
  })

  it('should return blank response when group id and artefact id are provided as input and suggestions are not present', async () => {
    const groupId = '12345'
    const artefactId = '1234'
    expect(getResponse(`${groupId}-${artefactId}`)).to.be.deep.equal([])
  })

  function getResponse(coordinate) {
    const body = fs.readFileSync(`test/fixtures/origins/maven/${coordinate}.json`)
    if (coordinate.endsWith('-response')) return JSON.parse(body)
    return router._getSuggestions(JSON.parse(body))
  }
})

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
