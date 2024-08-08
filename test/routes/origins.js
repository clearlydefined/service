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
    expect(
      router._getSuggestions(loadFixture(`${fixturePath}/${invalidGroupId}-${invalidArtifactId}.json`), invalidGroupId)
    ).to.be.deep.equal([])
  })

  function getResponse(filename) {
    return router._getSuggestions(loadFixture(`${fixturePath}/${filename}.json`))
  }
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
