// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const httpMocks = require('node-mocks-http')
const definitionRoutes = require('../../routes/definitions')

describe('Get a definition', () => {
  it('existing definitions offer a header cache-tag', async () => {
    const request = createRequest()
    const response = createResponse()
    const definitionService = {
      get: () => Promise.resolve({ 'data': [{ 'described': { 'releaseDate': '2017-09-01', 'urls': { 'registry': 'https://npmjs.com/package/microsoft-adaptivecards', 'version': 'https://npmjs.com/package/microsoft-adaptivecards/v/0.6.1', 'download': 'https://registry.npmjs.com/microsoft-adaptivecards/-/microsoft-adaptivecards-0.6.1.tgz' }, 'projectWebsite': 'http://adaptivecards.io', 'issueTracker': 'https://github.com/microsoft/AdaptiveCards/issues', 'hashes': { 'sha1': '73c4951e557b3cdfda68ab467c88308aa68c7e75', 'sha256': '1e763083a82dbcfee5e1dbb3f6e276a50f0f79e027536a789e529925441bb861' }, 'files': 30, 'tools': ['clearlydefined/1.3.3', 'licensee/9.12.1', 'scancode/3.2.2', 'fossology/3.6.0'], 'toolScore': { 'total': 30, 'date': 30, 'source': 0 }, 'score': { 'total': 30, 'date': 30, 'source': 0 } }, 'licensed': { 'declared': 'MIT', 'toolScore': { 'total': 46, 'declared': 30, 'discovered': 1, 'consistency': 0, 'spdx': 15, 'texts': 0 }, 'facets': { 'core': { 'attribution': { 'unknown': 29, 'parties': ['(c) (tm)', 'Copyright Joyent, Inc. and other Node contributors.'] }, 'discovered': { 'unknown': 27, 'expressions': ['MIT', 'NOASSERTION'] }, 'files': 30 } }, 'score': { 'total': 46, 'declared': 30, 'discovered': 1, 'consistency': 0, 'spdx': 15, 'texts': 0 } }, 'coordinates': { 'type': 'npm', 'provider': 'npmjs', 'name': 'microsoft-adaptivecards', 'revision': '0.6.1' }, '_meta': { 'schemaVersion': '1.6.1', 'updated': '2019-04-02T18:19:15.017Z' }, 'scores': { 'effective': 38, 'tool': 38 } }, { 'described': { 'releaseDate': '2017-05-12', 'urls': { 'registry': 'https://npmjs.com/package/microsoft-adaptivecards', 'version': 'https://npmjs.com/package/microsoft-adaptivecards/v/0.5.6', 'download': 'https://registry.npmjs.com/microsoft-adaptivecards/-/microsoft-adaptivecards-0.5.6.tgz' }, 'projectWebsite': 'http://adaptivecards.io', 'issueTracker': 'https://github.com/microsoft/AdaptiveCards/issues', 'hashes': { 'sha1': '78b2d40a7a1ced84974d900dced83190a9a3be95', 'sha256': '38017b720f32a97d1a9fda9faeb5eadb59bd26417032cc59a3f752842fe4dd8d' }, 'files': 36, 'tools': ['clearlydefined/1.3.3', 'licensee/9.12.1', 'scancode/3.2.2', 'fossology/3.6.0'], 'toolScore': { 'total': 30, 'date': 30, 'source': 0 }, 'score': { 'total': 30, 'date': 30, 'source': 0 } }, 'licensed': { 'declared': 'MIT', 'toolScore': { 'total': 46, 'declared': 30, 'discovered': 1, 'consistency': 0, 'spdx': 15, 'texts': 0 }, 'facets': { 'core': { 'attribution': { 'unknown': 35, 'parties': ['(c) (tm)', 'Copyright Joyent, Inc. and other Node contributors.'] }, 'discovered': { 'unknown': 33, 'expressions': ['MIT', 'NOASSERTION'] }, 'files': 36 } }, 'score': { 'total': 46, 'declared': 30, 'discovered': 1, 'consistency': 0, 'spdx': 15, 'texts': 0 } }, 'coordinates': { 'type': 'npm', 'provider': 'npmjs', 'name': 'microsoft-adaptivecards', 'revision': '0.5.6' }, '_meta': { 'schemaVersion': '1.6.1', 'updated': '2019-04-04T01:19:00.83Z' }, 'scores': { 'effective': 38, 'tool': 38 } }, { 'described': { 'releaseDate': '2017-06-19', 'urls': { 'registry': 'https://npmjs.com/package/microsoft-adaptivecards', 'version': 'https://npmjs.com/package/microsoft-adaptivecards/v/0.6.0', 'download': 'https://registry.npmjs.com/microsoft-adaptivecards/-/microsoft-adaptivecards-0.6.0.tgz' }, 'projectWebsite': 'http://adaptivecards.io', 'issueTracker': 'https://github.com/microsoft/AdaptiveCards/issues', 'hashes': { 'sha1': 'd7e03d22695ed186b216d08e76c65cd456094e1a', 'sha256': 'f78ede47858d599723dc1d39ef2d3fdf21a02bc4e938809d51a3ca634a0ba135' }, 'files': 29, 'tools': ['clearlydefined/1.3.4', 'licensee/9.12.1', 'scancode/3.2.2', 'fossology/3.6.0'], 'toolScore': { 'total': 30, 'date': 30, 'source': 0 }, 'score': { 'total': 30, 'date': 30, 'source': 0 } }, 'licensed': { 'declared': 'MIT', 'toolScore': { 'total': 46, 'declared': 30, 'discovered': 1, 'consistency': 0, 'spdx': 15, 'texts': 0 }, 'facets': { 'core': { 'attribution': { 'unknown': 28, 'parties': ['(c) (tm)', 'Copyright Joyent, Inc. and other Node contributors.'] }, 'discovered': { 'unknown': 26, 'expressions': ['MIT', 'NOASSERTION'] }, 'files': 29 } }, 'score': { 'total': 46, 'declared': 30, 'discovered': 1, 'consistency': 0, 'spdx': 15, 'texts': 0 } }, 'coordinates': { 'type': 'npm', 'provider': 'npmjs', 'name': 'microsoft-adaptivecards', 'revision': '0.6.0' }, '_meta': { 'schemaVersion': '1.6.1', 'updated': '2019-04-03T21:36:51.344Z' }, 'scores': { 'effective': 38, 'tool': 38 } }], 'continuationToken': '' }),
      tagFromCoordinates: () => 1234
    }
    const router = createRoutes(definitionService)
    await router._getDefinition(request, response)
    expect(response.statusCode).to.be.eq(200)
    expect(response.header('cache-tag'), 'cache-tag should be some value').to.not.be.undefined
    expect(response.header('cache-tag'), 'cache-tag cannot contain spaces').to.not.contain(' ')
    expect(response.header('cache-tag')).to.equal(definitionService.tagFromCoordinates().toString(), 'cache-tag needs to be what was provided by the service')
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

function createResponse() {
  let mockResponse = httpMocks.createResponse()
  mockResponse.header = function (name, value) {
    return value ? mockResponse.set(name, value) : mockResponse.getHeader(name)
  }
  return mockResponse
}