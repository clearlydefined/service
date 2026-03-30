// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { expect } from 'chai'
import httpMocks from 'node-mocks-http'
import sinon from 'sinon'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import utils from '../../lib/utils.js'
import harvestRoutes from '../../routes/harvest.js'
import ListBasedFilter from '../../providers/harvest/throttling/listBasedFilter.js'

// Shared noop logger for tests
const logger = {
  info: () => {},
  debug: () => {},
  error: () => {},
  warn: () => {},
  log: () => {}
}

describe('Harvest route', () => {
  afterEach(() => sinon.restore())

  it('rejects empty queue POST', async () => {
    const request = createRequest()
    const response = httpMocks.createResponse()
    const router = createRoutes()
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(400)
  })

  it('rejects additional properties POST', async () => {
    const request = createRequest({ tool: 'foo', coordinates: '/2/3/4', boo: 3 })
    const response = httpMocks.createResponse()
    const router = createRoutes()
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(400)

    const responseData = response._getData()
    expect(responseData).to.have.property('error', 'Validation failed')
    expect(responseData.details).to.be.an('array')
    expect(responseData.details[0].message).to.eq('must NOT have additional properties')
  })

  it('rejects wrong value POST', async () => {
    const request = createRequest({ tool: { invalid: 'object' }, coordinates: '/2/3/4' })
    const response = httpMocks.createResponse()
    const router = createRoutes()
    await router._queue(request, response)

    const responseData = response._getData()

    expect(response.statusCode).to.be.eq(400)
    expect(responseData).to.have.property('error', 'Validation failed')
    expect(responseData.details).to.be.an('array')
    expect(responseData.details[0].message).to.eq('must be string')
  })

  it('accepts good queuing POST', async () => {
    const request = createRequest({ tool: 'test', coordinates: '1/2/3/4' })
    const response = httpMocks.createResponse()
    const harvester = { harvest: sinon.stub() }
    const router = createRoutes(harvester)
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(201)
    expect(harvester.harvest.calledOnce).to.be.true
    expect(harvester.harvest.calledWith([{ tool: 'test', coordinates: '1/2/3/4' }], sinon.match.any)).to.be.true
  })

  it('filter out falsy coordinates', async () => {
    const request = createRequest([{ tool: 'test', coordinates: '1/2/3/4' }, null])
    const response = httpMocks.createResponse()
    const harvester = { harvest: sinon.stub() }
    const router = createRoutes(harvester)
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(201)
    expect(harvester.harvest.calledOnce).to.be.true
    expect(harvester.harvest.calledWith([{ tool: 'test', coordinates: '1/2/3/4' }], sinon.match.any)).to.be.true
  })

  it('normalize coordinates', async () => {
    const harvester = { harvest: sinon.stub() }
    const router = createRoutes(harvester)
    sinon.stub(utils, 'toNormalizedEntityCoordinates').resolves(EntityCoordinates.fromString('one/two/three/four'))
    const normalized = await router._normalizeCoordinates([{ tool: 'test', coordinates: '1/2/3/4' }])
    expect(normalized).to.deep.equal([{ tool: 'test', coordinates: 'one/two/three/four' }])
  })

  it('summarize harvested data for given tool and tool version', async () => {
    const request = createGetRequest({ tool: 'test', toolVersion: 'toolVersion' })
    const response = httpMocks.createResponse()
    const harvester = { harvest: sinon.stub() }
    const harvestStore = { get: sinon.stub() }
    const summarizer = { summarizeAll: sinon.stub().resolves({}) }
    const router = createRoutes(harvester, harvestStore, summarizer)
    await router._get(request, response)
    expect(response.statusCode).to.be.eq(200)
  })

  it('throttles via ListBasedFilter (422)', async () => {
    const entries = [{ tool: 'test', coordinates: 'git/github/Org/Name/1.0.0' }]
    const request = createRequest(entries)
    const response = httpMocks.createResponse()
    const harvester = { harvest: sinon.stub() }
    const throttler = new ListBasedFilter({ blacklist: ['git/github/org/name'], logger })
    sinon
      .stub(utils, 'toNormalizedEntityCoordinates')
      .resolves(EntityCoordinates.fromString('git/github/org/name/1.0.0'))
    const router = (harvestRoutes as Function)(harvester, undefined, undefined, throttler, true)
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(422)
    expect(harvester.harvest.calledOnce).to.be.false
  })
})

function createRoutes(harvester?: Record<string, sinon.SinonStub>, harvestStore?: Record<string, sinon.SinonStub>, summarizer?: Record<string, sinon.SinonStub>) {
  return (harvestRoutes as Function)(harvester, harvestStore, summarizer, new ListBasedFilter({ blacklist: [], logger }), true)
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
