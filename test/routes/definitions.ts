// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { expect } from 'chai'
import esmock from 'esmock'
import httpMocks from 'node-mocks-http'
import type { SinonStub } from 'sinon'
import sinon from 'sinon'

const logger = () => ({
  debug: () => {},
  error: () => {},
  info: () => {}
})

const definitionsRoutes = await esmock('../../routes/definitions.ts', {
  '../../providers/logging/logger.ts': logger
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
    expect(response.statusCode).to.be.eq(200)
    expect(definitionService.get.calledOnce).to.be.true
  })

  it('accepts a GET request with one extra param', async () => {
    const request = createGetWithExtraValues(['extra1'])
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(definitionService.get.calledOnce).to.be.true
  })

  it('accepts a GET request with two extra params', async () => {
    const request = createGetWithExtraValues(['extra1', 'extra2'])
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(definitionService.get.calledOnce).to.be.true
  })

  it('accepts a GET request with three extra params', async () => {
    const request = createGetWithExtraValues(['extra1', 'extra2', 'extra3'])
    const response = httpMocks.createResponse()
    await router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(definitionService.get.calledOnce).to.be.true
  })

  it('forces a recompute if requested', async () => {
    const request = createGetForceComputeRequest()
    const response = httpMocks.createResponse()
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
    computeAndStore: sinon.stub(),
    get: sinon.stub()
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
    // @ts-expect-error - test passes stub directly
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
