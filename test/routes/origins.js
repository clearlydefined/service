// @ts-nocheck
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect, assert } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const fs = require('fs')
const originMavenRoutes = require('../../routes/originMaven')

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

function loadFixture(path) {
  const body = fs.readFileSync(path)
  return JSON.parse(body)
}
