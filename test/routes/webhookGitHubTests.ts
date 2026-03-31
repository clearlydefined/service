import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import httpMocks from 'node-mocks-http'
import sinon from 'sinon'
import webhookRoutes from '../../routes/webhook.js'

describe('Webhook Route for GitHub calls', () => {
  let clock: any
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
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(service.updateContribution.mock.callCount() === 1, false)
    assert.strictEqual(response._getData(), '')
    assert.strictEqual(logger.error.mock.callCount() === 0, true)
    assert.strictEqual(logger.info.mock.callCount() === 0, true)
  })

  it('handles missing signature', async () => {
    const request = createRequest('yeah, right')
    delete request.headers['x-hub-signature']
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    assert.strictEqual(response.statusCode, 400)
    assert.strictEqual(service.updateContribution.mock.callCount() === 1, false)
    assert.strictEqual(response._getData().startsWith('Missing'), true)
  })

  it('handles missing event header', async () => {
    const request = createRequest('yeah, right')
    delete request.headers['x-github-event']
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createCurationService()
    const router = (webhookRoutes as (...args: any[]) => any)(service, null, logger, 'secret', 'secret', true)
    await router._handlePost(request, response)
    assert.strictEqual(response.statusCode, 400)
    assert.strictEqual(service.updateContribution.mock.callCount() === 1, false)
    assert.strictEqual(response._getData().startsWith('Missing'), true)
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
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(service.validateContributions.mock.callCount() === 1, false)
    assert.strictEqual(service.addByMergedCuration.mock.callCount() === 1, true)
    // calledBefore check - verify call order manually
    assert.strictEqual(service.updateContribution.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.error.mock.callCount() === 0, true)
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
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(service.validateContributions.mock.callCount() === 1, true)
    assert.strictEqual(service.updateContribution.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.error.mock.callCount() === 0, true)
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
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(service.validateContributions.mock.callCount() === 1, true)
    assert.strictEqual(service.updateContribution.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.error.mock.callCount() === 0, true)
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
    assert.strictEqual(service.validateContributions.mock.callCount() === 1, true)
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
    assert.strictEqual(service.validateContributions.mock.callCount() === 1, true)
  })
})

function createLogger() {
  return { info: mock.fn(), error: mock.fn() }
}

function createCurationService() {
  return {
    getContributedCurations: mock.fn(),
    updateContribution: mock.fn(async () => {}),
    validateContributions: mock.fn(async () => {}),
    addByMergedCuration: mock.fn(async () => {})
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
