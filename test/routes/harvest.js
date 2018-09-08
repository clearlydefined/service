// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')
const harvestRoutes = require('../../routes/harvest')

describe('Harvest route', () => {
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
    expect(response._getData()).to.be.eq('/0 should NOT have additional properties')
  })

  it('rejects wrong value POST', async () => {
    const request = createRequest({ tool: 1, coordinates: '/2/3/4' })
    const response = httpMocks.createResponse()
    const router = createRoutes()
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(400)
    expect(response._getData()).to.be.eq('/0/tool should be string')
  })

  it('accepts good queuing POST', async () => {
    const request = createRequest({ tool: 'test', coordinates: '1/2/3/4' })
    const response = httpMocks.createResponse()
    const harvester = { harvest: sinon.stub() }
    const router = createRoutes(harvester)
    await router._queue(request, response)
    expect(response.statusCode).to.be.eq(201)
    expect(harvester.harvest.calledOnce).to.be.true
  })
})

function createRoutes(harvester) {
  return harvestRoutes(harvester, null, null, true)
}

function createEntry(tool, coordinates, payload) {
  return { tool, coordinates, payload }
}

function createRequest(entries) {
  return httpMocks.createRequest({
    method: 'POST',
    url: '/',
    body: entries
    // body: JSON.stringify(entries)
  })
}
