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

function createRoutes(definition) {
  return definitionsRoutes(definition, true)
}

function createDefinitionService() {
  return {
    computeAndStore: sinon.stub(),
    get: sinon.stub()
  }
}

describe('Definition adjust result keys ', () => {
  let router

  function mockResult() {
    return { a: { test: 'a' }, b: { test: 'b' }, d: { test: 'd' } }
  }
  function mockMapping() {
    return new Map([['c', 'a']])
  }

  beforeEach(() => {
    router = createRoutes(sinon.stub())
  })

  afterEach(() => {
    sinon.restore()
  })

  it('match case: true', () => {
    const expected = { a: { test: 'a' }, b: { test: 'b' }, D: { test: 'd' } }
    const stub = sinon.stub(Array.prototype, 'reduce').callThrough()
    const actual = router._adaptResultKeys(mockResult(), ['a', 'b', 'D'], new Map(), true)
    expect(actual).to.deep.equal(expected)
    expect(stub.calledOnce).to.be.true
  })

  it('match case: false', () => {
    const expected = { a: { test: 'a' }, b: { test: 'b' }, d: { test: 'd' } }
    const stub = sinon.stub(Array.prototype, 'reduce').callThrough()
    const actual = router._adaptResultKeys(mockResult(), ['a', 'b', 'D'], new Map())
    expect(actual).to.deep.equal(expected)
    expect(stub.calledOnce).to.be.false
  })

  it('with coordinates mapping, match case: true', () => {
    const expected = { c: { test: 'a' }, b: { test: 'b' }, D: { test: 'd' } }
    const actual = router._adaptResultKeys(mockResult(), ['c', 'b', 'D'], mockMapping(), true)
    expect(actual).to.deep.equal(expected)
  })

  it('with coordinates mapping, match case: false', () => {
    const expected = { c: { test: 'a' }, b: { test: 'b' }, d: { test: 'd' } }
    const actual = router._adaptResultKeys(mockResult(), ['c', 'b', 'D'], mockMapping())
    expect(actual).to.deep.equal(expected)
  })

  it('duplicates after coordinates mapping, match case: true', () => {
    const expected = { a: { test: 'a' }, c: { test: 'a' }, b: { test: 'b' }, D: { test: 'd' } }
    const actual = router._adaptResultKeys(mockResult(), ['a', 'c', 'b', 'D'], mockMapping(), true)
    expect(actual).to.deep.equal(expected)
  })
})
