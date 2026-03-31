import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import httpMocks from 'node-mocks-http'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import definitionsRoutes from '../../routes/definitions-1.0.0.js'

describe('Definition v1.0.0 route', () => {
  it('accepts a good GET request', async () => {
    const request = createGetRequest()
    const response = httpMocks.createResponse()
    const definitionService = createDefinitionService()
    const router = createRoutes(definitionService)
    await router._getDefinition(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(definitionService.get.mock.callCount() === 1, true)
    const coordinates = EntityCoordinates.fromString('go/golang/github.com%2Fquasilyte%2Fregex/syntax/v0.0.0')
    assert.deepStrictEqual(definitionService.get.mock.calls[0].arguments[0], coordinates)
  })

  it('forces a recompute if requested', async () => {
    const request = createGetForceComputeRequest()
    const response = httpMocks.createResponse()
    const definitionService = createDefinitionService()
    const router = createRoutes(definitionService)
    await router._getDefinition(request, response)
    assert.strictEqual(response.statusCode, 200)
    const getDefinitionSpy = definitionService.get
    assert.strictEqual(getDefinitionSpy.mock.calls[0].arguments[2], true)
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

function createRoutes(definition: Record<string, ReturnType<typeof mock.fn>>): Record<string, (...args: any[]) => any> {
  return (definitionsRoutes as (...args: any[]) => any)(definition, true)
}

function createDefinitionService() {
  return {
    computeAndStore: mock.fn(),
    get: mock.fn()
  }
}
