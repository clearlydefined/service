// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const webhookRoutes = require('../../routes/webhook')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')

describe('Webhook Route for Crawler calls', () => {
  it('handles basic header signature', () => {
    const request = createRequest('urn:npm:npmjs:-:test:revision:0.1.0')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createDefinitionService()
    const router = webhookRoutes(null, service, logger, 'secret', 'secret', true)
    router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(service.computeStoreAndCurate.calledOnce).to.be.true
    expect(service.computeStoreAndCurate.getCall(0).args[0].name).to.be.eq('test')
  })

  it('handles missing self', () => {
    const request = createRequest()
    const response = httpMocks.createResponse(null, null)
    const logger = createLogger()
    const service = createDefinitionService()
    const router = webhookRoutes(null, service, logger, 'secret', 'secret', true)
    router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(400)
    expect(service.computeStoreAndCurate.calledOnce).to.be.false
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.args[0][0].startsWith('Fatal')).to.be.true
  })

  it('handles incorrect token', () => {
    const request = createRequest('urn:npm:npmjs:-:test:revision:0.1.0')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createDefinitionService()
    const router = webhookRoutes(null, service, logger, 'secret', 'different', true)
    router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(400)
    expect(service.computeStoreAndCurate.calledOnce).to.be.false
    expect(logger.info.calledOnce).to.be.true
    expect(logger.info.args[0][0].startsWith('Fatal')).to.be.true
  })
})

function createLogger() {
  return { info: sinon.stub(), error: sinon.stub() }
}

function createDefinitionService() {
  return {
    computeStoreAndCurate: sinon.stub()
  }
}

function createRequest(urn, links) {
  return httpMocks.createRequest({
    method: 'POST',
    url: '/',
    headers: {
      'x-crawler': 'secret'
    },
    body: JSON.stringify({
      _metadata: {
        links: links || { self: { href: urn } }
      }
    })
  })
}
