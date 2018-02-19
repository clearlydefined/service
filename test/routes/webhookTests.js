// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const { expect } = require('chai');
const webhookRoutes = require('../../routes/webhook');
const httpMocks = require('node-mocks-http');
const sinon = require('sinon');

describe('Webhook Route', () => {
  it('handles invalid action', () => {
    const request = createRequest('yeah, right');
    const response = httpMocks.createResponse();
    const logger = { error: sinon.stub() };
    const service = createCurationService();
    const router = webhookRoutes(service, logger, 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(200);
    expect(service.handleMerge.calledOnce).to.be.false;
    expect(service.validateCurations.calledOnce).to.be.false;
    expect(response._getData()).to.be.eq('');
  });

  it('handles missing signature', () => {
    const request = createRequest('yeah, right');
    delete request.headers['x-hub-signature'];
    const response = httpMocks.createResponse();
    const logger = { error: sinon.stub() };
    const service = createCurationService();
    const router = webhookRoutes(service, logger, 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(400);
    expect(service.handleMerge.calledOnce).to.be.false;
    expect(service.validateCurations.calledOnce).to.be.false;
    expect(response._getData().startsWith('Missing')).to.be.true;
  });

  it('handles missing event header', () => {
    const request = createRequest('yeah, right');
    delete request.headers['x-github-event'];
    const response = httpMocks.createResponse();
    const logger = { error: sinon.stub() };
    const service = createCurationService();
    const router = webhookRoutes(service, logger, 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(400);
    expect(service.handleMerge.calledOnce).to.be.false;
    expect(service.validateCurations.calledOnce).to.be.false;
    expect(response._getData().startsWith('Missing')).to.be.true;
  });

  it('handles closed event that is merged', () => {
    const request = createRequest('closed', true);
    const response = httpMocks.createResponse();   
    const service = createCurationService();
    const router = webhookRoutes(service, null, 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(200);
    expect(service.validateCurations.calledOnce).to.be.false;
    expect(service.handleMerge.calledOnce).to.be.true;
    expect(service.handleMerge.getCall(0).args[0]).to.be.eq(1);
    expect(service.handleMerge.getCall(0).args[1]).to.be.eq('changes');
  });

  it('skips closed event that is not merged', () => {
    const request = createRequest('closed', false);
    const response = httpMocks.createResponse();   
    const service = createCurationService();
    const router = webhookRoutes(service, null, 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(200);
    expect(service.handleMerge.calledOnce).to.be.false;
    expect(service.validateCurations.calledOnce).to.be.false;
  });

  it('calls valid for PR changes', () => {
    const request = createRequest('opened');
    const response = httpMocks.createResponse();   
    const service = createCurationService();
    const router = webhookRoutes(service, null, 'secret', true);
    router._handlePost(request, response);
    expect(response.statusCode).to.be.eq(200);
    expect(service.handleMerge.calledOnce).to.be.false;
    expect(service.validateCurations.calledOnce).to.be.true;
    expect(service.validateCurations.getCall(0).args[0]).to.be.eq(1);
    expect(service.validateCurations.getCall(0).args[1]).to.be.eq('test pr');
    expect(service.validateCurations.getCall(0).args[2]).to.be.eq('24');
    expect(service.validateCurations.getCall(0).args[3]).to.be.eq('changes');
  });
});

function createCurationService() {
  return  {
    handleMerge: sinon.stub(),
    validateCurations: sinon.stub(),
  };
}

function createRequest(action, merged) {
  return httpMocks.createRequest({
    method: 'POST',
    url: '/',
    params: {
      id: 42
    },
    headers: {
      'x-github-event': 'sure is',
      'x-hub-signature': 'some hash'
    },
    body: JSON.stringify({
      action,
      pull_request: {
        number: 1,
        title: 'test pr',
        merged,
        head: {
          ref: 'changes',
          sha: '24'
        }
      }
    })
  });
}
