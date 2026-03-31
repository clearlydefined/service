import assert from 'node:assert/strict'
import { describe, it, afterEach, mock } from 'node:test'
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import httpMocks from 'node-mocks-http'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import utils from '../../lib/utils.js'
import ListBasedFilter from '../../providers/harvest/throttling/listBasedFilter.js'
import harvestRoutes from '../../routes/harvest.js'

// Shared noop logger for tests
const logger = {
  info: () => {},
  debug: () => {},
  error: () => {},
  warn: () => {},
  log: () => {}
}

describe('Harvest route', () => {
  afterEach(() => mock.restoreAll())

  it('rejects empty queue POST', async () => {
    const request = createRequest()
    const response = httpMocks.createResponse()
    const router = createRoutes()
    await router._queue(request, response)
    assert.strictEqual(response.statusCode, 400)
  })

  it('rejects additional properties POST', async () => {
    const request = createRequest({ tool: 'foo', coordinates: '/2/3/4', boo: 3 })
    const response = httpMocks.createResponse()
    const router = createRoutes()
    await router._queue(request, response)
    assert.strictEqual(response.statusCode, 400)

    const responseData = response._getData()
    assert.strictEqual(responseData['error'], 'Validation failed')
    assert.ok(Array.isArray(responseData.details))
    assert.strictEqual(responseData.details[0].message, 'must NOT have additional properties')
  })

  it('rejects wrong value POST', async () => {
    const request = createRequest({ tool: { invalid: 'object' }, coordinates: '/2/3/4' })
    const response = httpMocks.createResponse()
    const router = createRoutes()
    await router._queue(request, response)

    const responseData = response._getData()

    assert.strictEqual(response.statusCode, 400)
    assert.strictEqual(responseData['error'], 'Validation failed')
    assert.ok(Array.isArray(responseData.details))
    assert.strictEqual(responseData.details[0].message, 'must be string')
  })

  it('accepts good queuing POST', async () => {
    const request = createRequest({ tool: 'test', coordinates: '1/2/3/4' })
    const response = httpMocks.createResponse()
    const harvester = { harvest: mock.fn() }
    const router = createRoutes(harvester)
    await router._queue(request, response)
    assert.strictEqual(response.statusCode, 201)
    assert.strictEqual(harvester.harvest.mock.callCount() === 1, true)
    assert.strictEqual(harvester.harvest.calledWith([{ tool: 'test', coordinates: '1/2/3/4' }], sinon.match.any), true)
  })

  it('filter out falsy coordinates', async () => {
    const request = createRequest([{ tool: 'test', coordinates: '1/2/3/4' }, null])
    const response = httpMocks.createResponse()
    const harvester = { harvest: mock.fn() }
    const router = createRoutes(harvester)
    await router._queue(request, response)
    assert.strictEqual(response.statusCode, 201)
    assert.strictEqual(harvester.harvest.mock.callCount() === 1, true)
    assert.strictEqual(harvester.harvest.calledWith([{ tool: 'test', coordinates: '1/2/3/4' }], sinon.match.any), true)
  })

  it('normalize coordinates', async () => {
    const harvester = { harvest: mock.fn() }
    const router = createRoutes(harvester)
    mock.method(utils, 'toNormalizedEntityCoordinates').resolves(EntityCoordinates.fromString('one/two/three/four'))
    const normalized = await router._normalizeCoordinates([{ tool: 'test', coordinates: '1/2/3/4' }])
    assert.deepStrictEqual(normalized, [{ tool: 'test', coordinates: 'one/two/three/four' }])
  })

  it('summarize harvested data for given tool and tool version', async () => {
    const request = createGetRequest({ tool: 'test', toolVersion: 'toolVersion' })
    const response = httpMocks.createResponse()
    const harvester = { harvest: mock.fn() }
    const harvestStore = { get: mock.fn() }
    const summarizer = { summarizeAll: mock.fn(async () => {}) }
    const router = createRoutes(harvester, harvestStore, summarizer)
    await router._get(request, response)
    assert.strictEqual(response.statusCode, 200)
  })

  it('throttles via ListBasedFilter (422)', async () => {
    const entries = [{ tool: 'test', coordinates: 'git/github/Org/Name/1.0.0' }]
    const request = createRequest(entries)
    const response = httpMocks.createResponse()
    const harvester = { harvest: mock.fn() }
    const throttler = new ListBasedFilter({ blacklist: ['git/github/org/name'], logger })
    sinon
      .stub(utils, 'toNormalizedEntityCoordinates')
      .resolves(EntityCoordinates.fromString('git/github/org/name/1.0.0'))
    const router = (harvestRoutes as (...args: any[]) => any)(harvester, undefined, undefined, throttler, true)
    await router._queue(request, response)
    assert.strictEqual(response.statusCode, 422)
    assert.strictEqual(harvester.harvest.mock.callCount() === 1, false)
  })
})

function createRoutes(
  harvester?: Record<string, ReturnType<typeof mock.fn>>,
  harvestStore?: Record<string, ReturnType<typeof mock.fn>>,
  summarizer?: Record<string, ReturnType<typeof mock.fn>>
) {
  return (harvestRoutes as (...args: any[]) => any)(
    harvester,
    harvestStore,
    summarizer,
    new ListBasedFilter({ blacklist: [], logger }),
    true
  )
}

function createRequest(entries?: unknown) {
  return httpMocks.createRequest({
    method: 'POST',
    url: '/',
    body: entries
  })
}

function createGetRequest(entries: Record<string, string>) {
  return httpMocks.createRequest({
    method: 'GET',
    url: '/',
    params: entries
  })
}
