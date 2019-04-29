// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const definitionRoutes = require('../../routes/definitions')

describe('Get a definition', () => {
  it('existing definitions offer a header cache-tag', async () => {
    const request = createRequest()
    const response = httpMocks.createResponse()
    const definitionService = {
      get: () => Promise.resolve({ 'data': [{ 'described': { 'hashes': { 'sha1': 'b59796dace69776edd9a90dfd60d145cfcfe8dd7', 'sha256': '1822c47041e710eff217e33e9a3996912136bc10470cb6a2a39e414354af9870' }, 'files': 6, 'releaseDate': '2016-02-29', 'urls': { 'registry': 'https://nuget.org/packages/FastMicroservices.Marconi.Consul', 'version': 'https://nuget.org/packages/FastMicroservices.Marconi.Consul/0.1.1', 'download': 'https://nuget.org/api/v2/package/FastMicroservices.Marconi.Consul/0.1.1' }, 'tools': ['clearlydefined/1.4.0', 'licensee/9.12.1'], 'toolScore': { 'total': 30, 'date': 30, 'source': 0 }, 'score': { 'total': 30, 'date': 30, 'source': 0 } }, 'coordinates': { 'type': 'nuget', 'provider': 'nuget', 'name': 'FastMicroservices.Marconi.Consul', 'revision': '0.1.1' }, 'licensed': { 'toolScore': { 'total': 0, 'declared': 0, 'discovered': 0, 'consistency': 0, 'spdx': 0, 'texts': 0 }, 'facets': { 'core': { 'attribution': { 'unknown': 6 }, 'discovered': { 'unknown': 6 }, 'files': 6 } }, 'score': { 'total': 0, 'declared': 0, 'discovered': 0, 'consistency': 0, 'spdx': 0, 'texts': 0 } }, '_meta': { 'schemaVersion': '1.6.1', 'updated': '2019-04-17T04:52:36.233Z' }, 'scores': { 'effective': 15, 'tool': 15 } }], 'continuationToken': '' })
    }
    const router = createRoutes(definitionService)
    router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(response.header('Cache-Tag')).not.to.be.undefined()
    expect(response.header('Cache-Tag')).not.to.contain(' ')
  })
})

function createRoutes(definitionService) {
  return definitionRoutes(definitionService, true)
}

function createRequest() {
  return httpMocks.createRequest({
    method: 'GET',
    url: '/definitions',
    params: {
      name: 'FastMicroservices.Marconi.Consul',
      sort: 'releaseDate',
      sortDesc: true
    }
  })
}
