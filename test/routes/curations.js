// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const sinon = require('sinon')
const curationsRoutes = require('../../routes/curations')

describe('Curations route', () => {
  it('accepts a PATCH including url curations', async () => {
    const request = createRequest(require('../fixtures/issue-484-curation-request.json'), 'PATCH')
    request.app = {
      locals:
      {
        service:
        {
          github: {
            client: {}
          }
        },
        user:
        {
          github: {
            client: {},
            info: {}
          }
        }
      }
    }
    const response = httpMocks.createResponse()
    const service = {
      getCurationUrl: sinon.stub(),
      addOrUpdate: sinon.stub()
    }
    service.addOrUpdate.returns({ data: { number: 42 } })
    const router = createRoutes(service)
    await router._updateCurations(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(service.addOrUpdate.calledOnce).to.be.true
    expect(service.getCurationUrl.calledOnce).to.be.true
  })
})

function createRoutes(service) {
  return curationsRoutes(service, true)
}

function createRequest(body, method) {
  return httpMocks.createRequest({
    method,
    url: '/',
    body
  })
}
