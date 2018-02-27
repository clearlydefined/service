// Copyright (c) 2018, The Linux Foundation.
// SPDX-License-Identifier: MIT

const { expect } = require('chai');
const webhookRoutes = require('../../routes/webhook');
const httpMocks = require('node-mocks-http');
const sinon = require('sinon');

describe('Webhook Route for Crawler calls', () => {

  it('handles basic header signature', () => {
    const request = createRequest('urn:npm:npmjs:-:test:revision:0.1.0');
    const response = httpMocks.createResponse();
    const logger = { error: sinon.stub() };
    const service = createDefinitionService();
    const router = webhookRoutes(null, service, logger, 'secret', 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(200);
    expect(service.invalidate.calledOnce).to.be.true;
    expect(service.invalidate.getCall(0).args[0].name).to.be.eq('test');
  });

  it('handles missing self', () => {
    const request = createRequest();
    const response = httpMocks.createResponse(null, null);
    const logger = { error: sinon.stub() };
    const service = createDefinitionService();
    const router = webhookRoutes(null, service, logger, 'secret', 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(400);
    expect(service.invalidate.calledOnce).to.be.false;
    expect(logger.error.calledOnce).to.be.true;
  });

  it('handles incorrect token', () => {
    const request = createRequest('urn:npm:npmjs:-:test:revision:0.1.0');
    const response = httpMocks.createResponse();
    const logger = { error: sinon.stub() };
    const service = createDefinitionService();
    const router = webhookRoutes(null, service, logger, 'secret', 'different', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(400);
    expect(service.invalidate.calledOnce).to.be.false;
    expect(logger.error.calledOnce).to.be.true;
  });
});

function createDefinitionService() {
  return  {
    invalidate: sinon.stub()
  };
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
  });
}
