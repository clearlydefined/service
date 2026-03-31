import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach, mock } from 'node:test'
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT


const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const logger = () => ({
  debug: () => {},
  error: () => {},
  info: () => {}
})

const definitionsRoutes = proxyquire('../../routes/definitions', {
  '../providers/logging/logger': logger
})

describe('Definition route', () => {
  let router: Record<string, (...args: any[]) => any>
  let definitionService: Record<string, SinonStub>

  beforeEach(() => {
    definitionService = createDefinitionService()
    router = createRoutes(definitionService)
  })

  it('accepts a good GET request', async () => {
    const request = createGetRequest()
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(definitionService.get.mock.callCount() === 1, true)
  })

  it('accepts a GET request with one extra param', async () => {
    const request = createGetWithExtraValues(['extra1'])
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(definitionService.get.mock.callCount() === 1, true)
  })

  it('accepts a GET request with two extra params', async () => {
    const request = createGetWithExtraValues(['extra1', 'extra2'])
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(definitionService.get.mock.callCount() === 1, true)
  })

  it('accepts a GET request with three extra params', async () => {
    const request = createGetWithExtraValues(['extra1', 'extra2', 'extra3'])
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(definitionService.get.mock.callCount() === 1, true)
  })

  it('forces a recompute if requested', async () => {
    const request = createGetForceComputeRequest()
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    assert.strictEqual(response.statusCode, 200)
    const getDefinitionSpy = definitionService.get
    assert.strictEqual(getDefinitionSpy.mock.calls[0].arguments[2], true)
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
      revision: '1.0.14'
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
      revision: '1.0.14'
    },
    query: {
      force: true
    }
  })
}

function createGetWithExtraValues(extraValues: string[] = []) {
  const baseParams: Record<string, string> = {
    type: 'crate',
    provider: 'cratesio',
    namespace: '-',
    name: 'syn',
    revision: '1.0.14'
  }

  extraValues.forEach((val, index) => {
    baseParams[`extra${index + 1}`] = val
  })

  const extraPath = extraValues.length ? `/${extraValues.join('/')}` : ''

  return httpMocks.createRequest({
    method: 'GET',
    url: `definitions/crate/cratesio/-/syn/1.0.14${extraPath}`,
    params: baseParams
  })
}

function createRoutes(definition: Record<string, SinonStub>) {
  return definitionsRoutes(definition, true)
}

function createDefinitionService() {
  return {
    computeAndStore: mock.fn(),
    get: mock.fn()
  }
}

describe('Definition adjust result keys ', () => {
  let router: Record<string, (...args: any[]) => any>

  function mockResult() {
    return { a: { test: 'a' }, b: { test: 'b' }, d: { test: 'd' } }
  }
  function mockMapping() {
    return new Map([['c', 'a']])
  }

  beforeEach(() => {
    router = createRoutes(mock.fn())
  })

  afterEach(() => {
    mock.restoreAll()
  })

  it('match case: true', () => {
    const expected = { a: { test: 'a' }, b: { test: 'b' }, D: { test: 'd' } }
    const stub = mock.method(Array.prototype, 'reduce').callThrough()
    const actual = router._adaptResultKeys(mockResult(), ['a', 'b', 'D'], new Map(), true)
    assert.deepStrictEqual(actual, expected)
    assert.strictEqual(stub.mock.callCount() === 1, true)
  })

  it('match case: false', () => {
    const expected = { a: { test: 'a' }, b: { test: 'b' }, d: { test: 'd' } }
    const stub = mock.method(Array.prototype, 'reduce').callThrough()
    const actual = router._adaptResultKeys(mockResult(), ['a', 'b', 'D'], new Map())
    assert.deepStrictEqual(actual, expected)
    assert.strictEqual(stub.mock.callCount() === 1, false)
  })

  it('with coordinates mapping, match case: true', () => {
    const expected = { c: { test: 'a' }, b: { test: 'b' }, D: { test: 'd' } }
    const actual = router._adaptResultKeys(mockResult(), ['c', 'b', 'D'], mockMapping(), true)
    assert.deepStrictEqual(actual, expected)
  })

  it('with coordinates mapping, match case: false', () => {
    const expected = { c: { test: 'a' }, b: { test: 'b' }, d: { test: 'd' } }
    const actual = router._adaptResultKeys(mockResult(), ['c', 'b', 'D'], mockMapping())
    assert.deepStrictEqual(actual, expected)
  })

  it('duplicates after coordinates mapping, match case: true', () => {
    const expected = { a: { test: 'a' }, c: { test: 'a' }, b: { test: 'b' }, D: { test: 'd' } }
    const actual = router._adaptResultKeys(mockResult(), ['a', 'c', 'b', 'D'], mockMapping(), true)
    assert.deepStrictEqual(actual, expected)
  })
})
