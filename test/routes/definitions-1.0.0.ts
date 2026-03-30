// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { expect } from 'chai'
import httpMocks from 'node-mocks-http'
import sinon from 'sinon'
import definitionsRoutes from '../../routes/definitions-1.0.0.js'
import EntityCoordinates from '../../lib/entityCoordinates.js'

describe('Definition v1.0.0 route', () => {
  it('accepts a good GET request', async () => {
    const request = createGetRequest()
    const response = httpMocks.createResponse()
    const definitionService = createDefinitionService()
    const router = createRoutes(definitionService)
    await router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(definitionService.get.calledOnce).to.be.true
    const coordinates = EntityCoordinates.fromString('go/golang/github.com%2Fquasilyte%2Fregex/syntax/v0.0.0')
    expect(definitionService.get.calledOnceWith(coordinates))
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
    url: 'definitions?coordinates=go%2Fgolang%2Fgithub.com%252Fquasilyte%252Fregex%2Fsyntax%2Fv0.0.0',
    hostname: 'https://dev.clearlydefined.io'
  })
}

function createGetForceComputeRequest() {
  return httpMocks.createRequest({
    method: 'GET',
    url: 'definitions?coordinates=crate%2Fcratesio%2F-%2Fsyn%2F1.0.14&force=true',
    hostname: 'https://dev.clearlydefined.io'
  })
}

function createRoutes(definition: Record<string, sinon.SinonStub>): Record<string, Function> {
  return (definitionsRoutes as Function)(definition, true)
}

function createDefinitionService() {
  return {
    computeAndStore: sinon.stub(),
    get: sinon.stub()
  }
}
