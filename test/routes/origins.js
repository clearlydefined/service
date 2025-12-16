// @ts-nocheck
// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect, assert } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const fs = require('fs')
const httpMocks = require('node-mocks-http')
const originMavenRoutes = require('../../routes/originMaven')
const originCondaRoutes = require('../../routes/originConda')

describe('Pypi origin routes', () => {
  let router
  let requestPromiseStub
  const fixturePath = 'test/fixtures/origins/pypi'
  beforeEach(() => {
    requestPromiseStub = sinon.stub()
    const createRoute = proxyquire('../../routes/originPyPi', { '../lib/fetch': { callFetch: requestPromiseStub } })
    router = createRoute(true)
  })

  afterEach(function () {
    sinon.restore()
  })

  it('should return a valid response when a valid package is provided as input', async () => {
    requestPromiseStub.returns({ body: loadFixture(`${fixturePath}/pandas.json`), statusCode: 200 })
    const response = await router._getPypiData('pandas')
    expect(response.body.info.name).to.be.equal('pandas')
  })

  it('should return an empty response when a missing package is provided as input', async () => {
    requestPromiseStub.throws({ body: { message: 'Not Found' }, statusCode: 404 })
    expect(await router._getPypiData('pand')).to.be.deep.equal({})
  })

  it('should return a valid error message when an error other than 404 occurs', async () => {
    requestPromiseStub.throws({ statusCode: 400 })
    try {
      await router._getPypiData('pand')
    } catch (error) {
      expect(error.statusCode).to.be.equal(400)
      return
    }
    //Fail the test case if the error is not thrown
    assert.fail('Error should have been thrown')
  })
})

describe('Maven origin routes', () => {
  let router
  const fixturePath = 'test/fixtures/origins/maven'

  before(() => {
    router = originMavenRoutes(true)
  })

  it('should return suggestions when incomplete group id is provided as input', async () => {
    const partialGroupId = 'org.apache.httpcom'
    expect(getResponse(partialGroupId)).to.be.deep.equal([
      'httpcore',
      'httpconn',
      'httpcodec',
      'httpcommons',
      'httprox'
    ])
  })

  it('should return list of artefacts when complete group id is provided as input', async () => {
    const completeGroupId = 'org.apache.httpcomponents'
    expect(getResponse(completeGroupId)).to.be.deep.equal(
      loadFixture(`${fixturePath}/${completeGroupId}-response.json`)
    )
  })

  it('should return blank response when group id is invalid and suggestions are not present', async () => {
    const invalidGroupId = '12345'
    expect(getResponse(invalidGroupId)).to.be.deep.equal([])
  })

  it('should return blank response when group id and artefact id are invalid and suggestions are not present', async () => {
    const invalidGroupId = '12345'
    const invalidArtifactId = '1234'
    const responseFilePath = loadFixture(`${fixturePath}/${invalidGroupId}-${invalidArtifactId}.json`)
    expect(router._getSuggestions(responseFilePath, invalidGroupId)).to.be.deep.equal([])
  })

  function getResponse(filename) {
    return router._getSuggestions(loadFixture(`${fixturePath}/${filename}.json`))
  }
})

describe('Conda origin routes', () => {
  let condaRepoAccess
  let cacheMock

  const requestPromiseStub = sinon.stub()
  const fetchModuleStub = {
    callFetch: requestPromiseStub
  }

  const createCondaRepoAccess = proxyquire('../../lib/condaRepoAccess', {
    './fetch': fetchModuleStub
  })

  const channelData = {
    packages: {
      tensorflow: { subdirs: ['linux-64'] }
    },
    subdirs: ['linux-64']
  }

  const repoData = {
    packages: {
      'pkg-2': { name: 'tensorflow', version: '2.15.0', build: 'cuda120py39hb94c71b_3' }
    }
  }

  beforeEach(() => {
    cacheMock = {
      get: sinon.stub(),
      set: sinon.stub()
    }

    condaRepoAccess = createCondaRepoAccess(cacheMock)
  })

  afterEach(() => {
    sinon.restore()
    requestPromiseStub.resetHistory()
  })

  it('handles a valid GET request for revisions', async () => {
    requestPromiseStub.onFirstCall().resolves(channelData)
    requestPromiseStub.onSecondCall().resolves(repoData)
    const request = createGetOriginCondaRevisionsRequest('tensorflow')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginCondaRevisions(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.deepEqual(response._getData(), ['linux-64:2.15.0-cuda120py39hb94c71b_3'])
    assert.isTrue(requestPromiseStub.calledTwice)
  })

  it('handles a valid GET request for package listings', async () => {
    requestPromiseStub.onFirstCall().resolves(channelData)
    const request = createGetOriginCondaRequest('conda-forge')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginConda(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.deepEqual(response._getData(), [{ id: 'tensorflow' }])
    assert.isTrue(requestPromiseStub.called)
  })

  it('returns a 404 error for a non-existent channel', async () => {
    requestPromiseStub.onFirstCall().resolves(channelData)
    const request = createGetOriginCondaRequest('tensor')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginConda(request, response)
    assert.strictEqual(response.statusCode, 404)
    assert.strictEqual(response._getData(), 'Unrecognized Conda channel tensor')
  })

  it('returns a 404 error for a non-existent package in revisions', async () => {
    requestPromiseStub.onFirstCall().resolves(channelData)
    requestPromiseStub.onSecondCall().resolves(repoData)
    const request = createGetOriginCondaRevisionsRequest('tensorflow1212')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginCondaRevisions(request, response)
    assert.strictEqual(response.statusCode, 404)
    assert.strictEqual(response._getData(), 'Package tensorflow1212 not found in channel conda-forge')
    assert.isTrue(requestPromiseStub.calledOnce)
  })

  function createGetOriginCondaRevisionsRequest(name) {
    return httpMocks.createRequest({
      method: 'GET',
      url: `/origins/conda/'conda-forge'/linux-64/${name}/revisions`,
      baseUrl: 'https://dev.clearlydefined.io',
      params: {
        channel: 'conda-forge',
        subdir: 'linux-64',
        name: name
      }
    })
  }

  function createGetOriginCondaRequest(channel) {
    return httpMocks.createRequest({
      method: 'GET',
      url: `/origins/conda/${channel}/tensorflow/`,
      baseUrl: 'https://dev.clearlydefined.io',
      params: {
        channel: channel,
        name: 'tensorflow'
      }
    })
  }

  function initializeRoutes() {
    return originCondaRoutes(condaRepoAccess, true)
  }
})

describe('GitHub origin routes', () => {
  let router
  let githubMock
  let loggerStub

  beforeEach(() => {
    loggerStub = {
      error: sinon.stub(),
      warn: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub()
    }

    githubMock = {
      search: {
        users: sinon.stub().resolves({
          data: { items: [{ login: 'octocat' }] }
        }),
        repos: sinon.stub().resolves({
          data: { items: [{ full_name: 'octocat/Hello-World' }] }
        })
      },
      rest: {
        repos: {
          listTags: sinon.stub()
        },
        git: {
          getTag: sinon.stub()
        }
      }
    }

    const proxiedOriginGitHubRoutes = proxyquire('../../routes/originGitHub', {
      '../providers/logging/logger': () => loggerStub
    })

    // Inject the real router
    router = proxiedOriginGitHubRoutes()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should handle /:login route (repo param omitted)', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat',
      params: { login: 'octocat' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })
    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter })

    await new Promise((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, err => {
        if (err) reject(err)
      })
    })

    expect(res.statusCode).to.equal(200)
    expect(res._getData()).to.deep.equal([{ id: 'octocat' }])
    expect(githubMock.search.users.calledOnce).to.be.true
  })

  it('should handle /:login/:repo route', async () => {
    githubMock.search.repos.resolves({
      data: { items: [{ full_name: 'octocat/Hello-World' }] }
    })

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter })

    await new Promise((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, err => {
        if (err) reject(err)
      })
    })

    expect(res.statusCode).to.equal(200)
    expect(res._getData()).to.deep.equal([{ id: 'octocat/Hello-World' }])
    expect(githubMock.search.repos.calledOnce).to.be.true
  })

  it('should handle /:login/:repo/revisions with only lightweight tags', async () => {
    githubMock.rest.repos.listTags.resolves({
      data: [
        {
          name: 'v1.0.0',
          commit: { sha: 'sha123', url: 'https://api.github.com/repos/octocat/Hello-World/commits/sha123' },
          zipball_url: 'https://api.github.com/repos/octocat/Hello-World/zipball/v1.0.0',
          tarball_url: 'https://api.github.com/repos/octocat/Hello-World/tarball/v1.0.0',
          node_id: 'node1'
        },
        {
          name: 'v2.0.0',
          commit: { sha: 'sha456', url: 'https://api.github.com/repos/octocat/Hello-World/commits/sha456' },
          zipball_url: 'https://api.github.com/repos/octocat/Hello-World/zipball/v2.0.0',
          tarball_url: 'https://api.github.com/repos/octocat/Hello-World/tarball/v2.0.0',
          node_id: 'node2'
        }
      ]
    })

    githubMock.rest.git.getTag.rejects({ status: 404 })

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World/revisions',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter })

    await new Promise((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, err => {
        if (err) reject(err)
      })
    })

    expect(res.statusCode).to.equal(200)
    expect(res._getData()).to.deep.equal([
      { tag: 'v2.0.0', sha: 'sha456' },
      { tag: 'v1.0.0', sha: 'sha123' }
    ])
    expect(githubMock.rest.repos.listTags.calledOnce).to.be.true
    expect(githubMock.rest.git.getTag.called).to.be.true
  })

  it('should handle /:login/:repo/revisions with annotated tags', async () => {
    githubMock.rest.repos.listTags.resolves({
      data: [
        {
          name: 'v1.0.0',
          commit: { sha: 'tagSha1' }
        }
      ]
    })
    githubMock.rest.git.getTag.resolves({
      data: { object: { sha: 'commitSha1' } }
    })

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World/revisions',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter })

    await new Promise((resolve, reject) => {
      res.on('finish', resolve)
      res.on('error', reject)
      router.handle(req, res, err => {
        if (err) reject(err)
      })
    })

    expect(res.statusCode).to.equal(200)
    expect(res._getData()).to.deep.equal([{ tag: 'v1.0.0', sha: 'commitSha1' }])
    expect(githubMock.rest.repos.listTags.calledOnce).to.be.true
    expect(githubMock.rest.git.getTag.calledOnce).to.be.true
  })

  it('should return empty array on 404 from GitHub', async () => {
    const notFoundError = new Error('Not Found')
    notFoundError.code = 404
    notFoundError.status = 404

    githubMock.rest.repos.listTags.rejects(notFoundError)

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World/revisions',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter })

    await new Promise((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, err => {
        if (err) reject(err)
      })
    })

    expect(res.statusCode).to.equal(200)
    expect(res._getData()).to.deep.equal([])
    expect(githubMock.rest.repos.listTags.calledOnce).to.be.true
  })
})

function loadFixture(path) {
  const body = fs.readFileSync(path)
  return JSON.parse(body)
}
