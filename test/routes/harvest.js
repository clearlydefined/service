// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')
const EntityCoordinates = require('../../lib/entityCoordinates')
const harvestRoutes = require('../../routes/harvest')
const ListBasedFilter = require('../../providers/harvest/throttling/listBasedFilter')
const utils = require('../../lib/utils')

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
    const request = createRequest({ tool: 1, coordinates: '/2/3/4' })
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

  it('uses throttler to filter some entries (422)', async () => {
    const entries = [
      { tool: 'test', coordinates: '1/2/3/4' },
      { tool: 'test', coordinates: '5/6/7/8' }
    ]
    const request = createRequest(entries)
    const response = httpMocks.createResponse()
    const harvester = { harvest: sinon.stub() }
    const throttler = { filter: async list => list.filter(x => x.coordinates !== '1/2/3/4') }
    const router = harvestRoutes(harvester, undefined, undefined, throttler, true)
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(422)
    expect(harvester.harvest.calledOnce).to.be.false
  })
})

function createRoutes(harvester, harvestStore, summarizer) {
  const logger = {
    debug: () => {},
    error: () => {}
  }
  return harvestRoutes(harvester, harvestStore, summarizer, new ListBasedFilter({ blacklist: [], logger }), true)
}

function createRequest(entries) {
  return httpMocks.createRequest({
    method: 'POST',
    url: '/',
    body: entries
    // body: JSON.stringify(entries)
  })
}

function createGetRequest(entries) {
  return httpMocks.createRequest({
    method: 'GET',
    url: '/',
    params: entries
  })
}
