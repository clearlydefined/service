// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { expect } from 'chai'
import httpMocks from 'node-mocks-http'
import sinon from 'sinon'
import webhookRoutes from '../../routes/webhook.ts'

describe('Webhook Route for GitHub calls', () => {
  let clock: sinon.SinonFakeTimers

  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
  })

  it('handles invalid action', async () => {
    const request = createRequest('yeah, right')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
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
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
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
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    expect(response.statusCode).to.be.eq(400)
    expect(service.updateContribution.calledOnce).to.be.false
    expect(response._getData().startsWith('Missing')).to.be.true
  })

  it('skips closed event that is not merged', async () => {
    const request = createRequest('closed', false)
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    const promise = router._handlePost(request, response)
    await clock.runAllAsync()
    await promise
    expect(response.statusCode).to.be.eq(200)
    expect(service.validateContributions.calledOnce).to.be.false
    expect(service.addByMergedCuration.calledOnce).to.be.true
    expect(service.addByMergedCuration.calledBefore(service.updateContribution))
    expect(service.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.error.notCalled).to.be.true
  })

  it('calls valid for PR changes', async () => {
    const request = createRequest('opened')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    const promise = router._handlePost(request, response)
    await clock.runAllAsync()
    await promise
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
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    const promise = router._handlePost(request, response)
    await clock.runAllAsync()
    await promise
    expect(response.statusCode).to.be.eq(200)
    expect(service.validateContributions.calledOnce).to.be.true
    expect(service.updateContribution.calledOnce).to.be.true
    expect(logger.info.calledOnce).to.be.true
    expect(logger.error.notCalled).to.be.true
  })

  it('validates the curation when a PR is opened', async () => {
    const request = createRequest('opened')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    const promise = router._handlePost(request, response)
    await clock.runAllAsync()
    await promise
    expect(service.validateContributions.calledOnce).to.be.true
  })

  it('validates the curation when a PR is reopened', async () => {
    const request = createRequest('reopened')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    const promise = router._handlePost(request, response)
    await clock.runAllAsync()
    await promise
    expect(service.validateContributions.calledOnce).to.be.true
  })
})

function createLogger() {
  return { info: sinon.stub(), error: sinon.stub() }
}

function createCurationService() {
  return {
    getContributedCurations: sinon.stub(),
    updateContribution: sinon.stub().resolves(),
    validateContributions: sinon.stub().resolves(),
    addByMergedCuration: sinon.stub().resolves()
  }
}

function createRequest(action: string, merged = true) {
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
    }) as unknown
  })
}
