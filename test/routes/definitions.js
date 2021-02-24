// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')
const definitionsRoutes = require('../../routes/definitions')

describe('Definition route', () => {
  it('accepts a good GET request', async () => {
    const request = createGetRequest()
    const response = httpMocks.createResponse()
    const definitionService = createDefinitionService()
    const router = createRoutes(definitionService)
    await router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    //    const getDefinitionSpy = definitionService.get
    //    console.log(getDefinitionSpy.args)
    //    console.log(getDefinitionSpy.args[0])
    expect(definitionService.get.calledOnce).to.be.true
  })

  it('forces a recompute if requested', async () => {
    const request = createGetForceComputeRequest()
    const response = httpMocks.createResponse()
    const definitionService = createDefinitionService()
    const router = createRoutes(definitionService)
    await router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    const getDefinitionSpy = definitionService.get
    expect(getDefinitionSpy.args[0][2]).to.be.true
  })
})

function createGetRequest() {
  return httpMocks.createRequest({
    method: 'GET',
    url: 'definitions/crate/cratesio/-/syn/1.0.14',
    hostname: 'https://dev.clearlydefined.io',
    params: {
      type: 'crate',
      provider: 'cratesio',
      namespace: '-',
      revision: '1.0.14',
    }
  })
}

function createGetForceComputeRequest() {
  return httpMocks.createRequest({
    method: 'GET',
    url: 'definitions/crate/cratesio/-/syn/1.0.14',
    hostname: 'https://dev.clearlydefined.io',
    params: {
      type: 'crate',
      provider: 'cratesio',
      namespace: '-',
      revision: '1.0.14',
    },
    query: {
      force: true
    }
  })
}

function createRoutes(definition) {
  return definitionsRoutes(definition, true)
}

function createDefinitionService() {
  return {
    computeAndStore: sinon.stub(),
    get: sinon.stub()
  }
}

