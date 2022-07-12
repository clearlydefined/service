// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const middleware = require('../../middleware/pathToParams')

describe('pathToParams middleware', () => {
  it('should parse request.params[0]', () => {
    const request = { params : { '0': 'crate/cratesio/-/syn/1.0.14' } }
    middleware(request, null, () => {
      const  { params } = request
      expect(params.type).to.be.equal('crate')
      expect(params.provider).to.be.equal('cratesio')
      expect(params.namespace).to.be.equal('-')
      expect(params.name).to.be.equal('syn')
      expect(params.revision).to.be.equal('1.0.14')
    })
  })

  it('should reject invalid coordinates', () => {
    const request = { params : { '0': 'crate/cratesio/syn/1.0.14' } }
    const response = httpMocks.createResponse()
    middleware(request, response, null)
    expect(response.statusCode).to.be.equal(400)
  })

  it('does nothing if request.params[0] is falsy', () => {
    const params = {}
    const request = { params }
    middleware(request, null, () => {
      expect(request.params).to.be.equal(params)
    })
  })
})