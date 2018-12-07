// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const webhookRoutes = require('../../routes/webhook')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')

describe('Webhook Route for GitHub calls', () => {
  it('handles invalid action', async () => {
    const request = createRequest('yeah, right')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = webhookRoutes(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(service.updateContribution.calledOnce).to.be.false
    expect(response._getData()).to.be.eq('')
    expect(logger.error.notCalled).to.be.true
    expect(logger.info.notCalled).to.be.true
  })

  it('handles missing signature', async () => {
    const request = createRequest('yeah, right')
    delete request.headers['x-hub-signature']
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = webhookRoutes(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(400)
    expect(service.updateContribution.calledOnce).to.be.false
    expect(response._getData().startsWith('Missing')).to.be.true
  })

  it('handles missing event header', async () => {
    const request = createRequest('yeah, right')
    delete request.headers['x-github-event']
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = webhookRoutes(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(400)
    expect(service.updateContribution.calledOnce).to.be.false
    expect(response._getData().startsWith('Missing')).to.be.true
  })

  // TODO for some reason this test is failing on Travis. Runs fine on my windows machine and
  // really should not be affected by environment. could be something with the async/await code
  // not working right on Travis.
  // it('handles closed event that is merged', async () => {
  //   const request = createRequest('closed', true)
  //   const response = httpMocks.createResponse()
  //   const curationService = createCurationService([simpleCoords])
  //   const definitionService = createDefinitionService()
  //   const router = webhookRoutes(curationService, definitionService, null, 'secret', 'secret', true)
  //   await router._handlePost(request, response)
  //   expect(response.statusCode).to.be.eq(200)
  //   expect(definitionService.invalidate.calledOnce).to.be.true
  //   expect(definitionService.invalidate.getCall(0).args[0][0]).to.be.eq(simpleCoords)
  //   expect(definitionService.computeAndStore.calledOnce).to.be.true
  //   expect(definitionService.computeAndStore.getCall(0).args[0]).to.be.eq(simpleCoords)
  // })

  it('skips closed event that is not merged', async () => {
    const request = createRequest('closed', false)
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = webhookRoutes(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(service.validateContributions.calledOnce).to.be.false
    expect(service.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.error.notCalled).to.be.true
  })

  it('calls valid for PR changes', async () => {
    const request = createRequest('opened')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = webhookRoutes(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(service.validateContributions.calledOnce).to.be.true
    expect(service.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.error.notCalled).to.be.true
  })

  it('calls missing for PR changes', async () => {
    const request = createRequest('opened')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = webhookRoutes(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(service.validateContributions.calledOnce).to.be.true
    expect(service.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.error.notCalled).to.be.true
  })
})

function createLogger() {
  return { info: sinon.stub(), error: sinon.stub() }
}

function createCurationService() {
  return {
    getContributedCurations: sinon.stub(),
    updateContribution: sinon.stub(),
    validateContributions: sinon.stub()
  }
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
  })
}
