import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import httpMocks from 'node-mocks-http'
import webhookRoutes from '../../routes/webhook.js'

describe('Webhook Route for Crawler calls', () => {
  it('handles basic header signature', () => {
    const request = createRequest('urn:npm:npmjs:-:test:revision:0.1.0')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createDefinitionService()
    const router = (webhookRoutes as (...args: any[]) => any)(null, service, logger, 'secret', 'secret', true)
    router._handlePost(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(service.computeAndStoreIfNecessary.mock.callCount() === 1, true)
    expect(service.computeAndStoreIfNecessary.mock.calls[0].arguments[0].name).to.be.eq('test')
  })

  it('handles missing self', () => {
    const request = createRequest()
    const response = httpMocks.createResponse()
    assert.strictEqual(response.statusCode, 200)
    assert.strictEqual(response._getData().length, 0)
    const logger = createLogger()
    const service = createDefinitionService()
    const router = (webhookRoutes as (...args: any[]) => any)(null, service, logger, 'secret', 'secret', true)
    router._handlePost(request, response)
    assert.strictEqual(response.statusCode, 400)
    assert.strictEqual(service.computeStoreAndCurate.mock.callCount() === 1, false)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0].startsWith('Fatal'), true)
  })

  it('handles missing links', () => {
    const request = createRequest(undefined, {})
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createDefinitionService()
    const router = (webhookRoutes as (...args: any[]) => any)(null, service, logger, 'secret', 'secret', true)
    router._handlePost(request, response)
    assert.strictEqual(response.statusCode, 400)
    assert.strictEqual(service.computeStoreAndCurate.mock.callCount() === 1, false)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0].startsWith('Fatal'), true)
  })

  it('handles incorrect token', () => {
    const request = createRequest('urn:npm:npmjs:-:test:revision:0.1.0')
    const response = httpMocks.createResponse()
    const logger = createLogger()
    const service = createDefinitionService()
    const router = (webhookRoutes as (...args: any[]) => any)(null, service, logger, 'secret', 'different', true)
    router._handlePost(request, response)
    assert.strictEqual(response.statusCode, 400)
    assert.strictEqual(service.computeStoreAndCurate.mock.callCount() === 1, false)
    assert.strictEqual(logger.info.mock.callCount() === 1, true)
    assert.strictEqual(logger.info.mock.calls[0].arguments[0].startsWith('Fatal'), true)
  })
})

function createLogger() {
  return { info: mock.fn(), error: mock.fn() }
}

function createDefinitionService() {
  return {
    computeStoreAndCurate: mock.fn(),
    computeAndStoreIfNecessary: mock.fn()
  }
}

function createRequest(urn?: string, links?: Record<string, unknown>) {
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
    }) as unknown
  })
}
