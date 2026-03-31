import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'

// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const proxyquire = require('proxyquire')
const fs = require('node:fs')
const httpMocks = require('node-mocks-http')
const originMavenRoutes = require('../../routes/originMaven')
const originCondaRoutes = require('../../routes/originConda')

describe('Pypi origin routes', () => {
  let router: Record<string, (...args: any[]) => any>
  let requestPromiseStub: any
  const fixturePath = 'test/fixtures/origins/pypi'
  beforeEach(() => {
    requestPromiseStub = mock.fn()
    const createRoute = proxyquire('../../routes/originPyPi', { '../lib/fetch': { callFetch: requestPromiseStub } })
    router = createRoute(true)
  })

  afterEach(() => {
    mock.restoreAll()
  })

  it('should return a valid response when a valid package is provided as input', async () => {
    requestPromiseStub.mock.mockImplementation(() => ({
      body: loadFixture(`${fixturePath}/pandas.json`),
      statusCode: 200
    }))
    const response = await router._getPypiData('pandas')
    assert.strictEqual(response.body.info.name, 'pandas')
  })

  it('should return an empty response when a missing package is provided as input', async () => {
    requestPromiseStub.mock.mockImplementation(() => {
      throw { body: { message: 'Not Found' }, statusCode: 404 }
    })
    assert.deepStrictEqual(await router._getPypiData('pand'), {})
  })

  it('should return a valid error message when an error other than 404 occurs', async () => {
    requestPromiseStub.mock.mockImplementation(() => {
      throw { statusCode: 400 }
    })
    try {
      await router._getPypiData('pand')
    } catch (error) {
      assert.strictEqual((error as Record<string, unknown>).statusCode, 400)
      return
    }
    //Fail the test case if the error is not thrown
    assert.fail('Error should have been thrown')
  })
})

describe('Maven origin routes', () => {
  let router: Record<string, (...args: any[]) => any>
  const fixturePath = 'test/fixtures/origins/maven'

  before(() => {
    router = originMavenRoutes(true)
  })

  it('should return suggestions when incomplete group id is provided as input', async () => {
    const partialGroupId = 'org.apache.httpcom'
    assert.deepStrictEqual(getResponse(partialGroupId), ['httpcore', 'httpconn', 'httpcodec', 'httpcommons', 'httprox'])
  })

  it('should return list of artefacts when complete group id is provided as input', async () => {
    const completeGroupId = 'org.apache.httpcomponents'
    assert.deepStrictEqual(getResponse(completeGroupId), loadFixture(`${fixturePath}/${completeGroupId}-response.json`))
  })

  it('should return blank response when group id is invalid and suggestions are not present', async () => {
    const invalidGroupId = '12345'
    assert.deepStrictEqual(getResponse(invalidGroupId), [])
  })

  it('should return blank response when group id and artefact id are invalid and suggestions are not present', async () => {
    const invalidGroupId = '12345'
    const invalidArtifactId = '1234'
    const responseFilePath = loadFixture(`${fixturePath}/${invalidGroupId}-${invalidArtifactId}.json`)
    assert.deepStrictEqual(router._getSuggestions(responseFilePath, invalidGroupId), [])
  })

  function getResponse(filename: string) {
    return router._getSuggestions(loadFixture(`${fixturePath}/${filename}.json`))
  }
})

describe('Conda origin routes', () => {
  let condaRepoAccess: Record<string, (...args: any[]) => any>
  let cacheMock: { get: any; set: any }

  const requestPromiseStub: any = mock.fn()
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
      get: mock.fn(),
      set: mock.fn()
    }

    condaRepoAccess = createCondaRepoAccess(cacheMock)
  })

  afterEach(() => {
    mock.restoreAll()
    requestPromiseStub.mock.resetCalls()
  })

  it('handles a valid GET request for revisions', async () => {
    let _stubCallN = 0
    requestPromiseStub.mock.mockImplementation(async () => (++_stubCallN === 1 ? channelData : repoData))
    const request = createGetOriginCondaRevisionsRequest('tensorflow')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginCondaRevisions(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.deepEqual(response._getData(), ['linux-64:2.15.0-cuda120py39hb94c71b_3'])
    assert.strictEqual(requestPromiseStub.mock.callCount() === 2, true)
  })

  it('handles a valid GET request for package listings', async () => {
    requestPromiseStub.mock.mockImplementation(async () => channelData)
    const request = createGetOriginCondaRequest('conda-forge')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginConda(request, response)
    assert.strictEqual(response.statusCode, 200)
    assert.deepEqual(response._getData(), [{ id: 'tensorflow' }])
    assert.strictEqual(requestPromiseStub.mock.callCount() > 0, true)
  })

  it('returns a 404 error for a non-existent channel', async () => {
    requestPromiseStub.mock.mockImplementation(async () => channelData)
    const request = createGetOriginCondaRequest('tensor')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginConda(request, response)
    assert.strictEqual(response.statusCode, 404)
    assert.strictEqual(response._getData(), 'Unrecognized Conda channel tensor')
  })

  it('returns a 404 error for a non-existent package in revisions', async () => {
    let _stubCallN = 0
    requestPromiseStub.mock.mockImplementation(async () => (++_stubCallN === 1 ? channelData : repoData))
    const request = createGetOriginCondaRevisionsRequest('tensorflow1212')
    const response = httpMocks.createResponse()

    const router = initializeRoutes()
    await router._getOriginCondaRevisions(request, response)
    assert.strictEqual(response.statusCode, 404)
    assert.strictEqual(response._getData(), 'Package tensorflow1212 not found in channel conda-forge')
    assert.strictEqual(requestPromiseStub.mock.callCount() === 1, true)
  })

  function createGetOriginCondaRevisionsRequest(name: string) {
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

  function createGetOriginCondaRequest(channel: string) {
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
  let router: Record<string, (...args: any[]) => any>
  let githubMock: Record<string, unknown>
  let loggerStub: Record<string, any>

  beforeEach(() => {
    loggerStub = {
      error: mock.fn(),
      warn: mock.fn(),
      info: mock.fn(),
      debug: mock.fn()
    }

    githubMock = {
      search: {
        users: sinon.stub().resolves({
          data: {
            items: [{ login: 'octocat' }]
          }
        }),
        repos: sinon.stub().resolves({
          data: {
            items: [{ full_name: 'octocat/Hello-World' }]
          }
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
    mock.restoreAll()
  })

  it('should handle /:login route (repo param omitted)', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat',
      params: { login: 'octocat' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })
    const res = httpMocks.createResponse({ eventEmitter: require('node:events').EventEmitter })

    await new Promise<void>((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, (err: Error) => {
        if (err) {
          reject(err)
        }
      })
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res._getData(), [{ id: 'octocat' }])
    assert.strictEqual((githubMock.search as Record<string, any>).users.calledOnce, true)
  })

  it('should handle /:login/:repo route', async () => {
    (githubMock.search as Record<string, any>).repos.mock.mockImplementation(async () => ({
      data: { items: [{ full_name: 'octocat/Hello-World' }] }
    })

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('node:events').EventEmitter })

    await new Promise<void>((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, (err: Error) => {
        if (err) {
          reject(err)
        }
      })
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res._getData(), [{ id: 'octocat/Hello-World' }])
    assert.strictEqual((githubMock.search as Record<string, any>).repos.calledOnce, true)
  })

  it('should handle /:login/:repo/revisions with only lightweight tags', async () => {
    ;(githubMock.rest as Record<string, Record<string, any>>).repos.listTags.resolves({
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

    ;(githubMock.rest as Record<string, Record<string, any>>).git.getTag.rejects({ status: 404 })

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World/revisions',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('node:events').EventEmitter })

    await new Promise<void>((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, (err: Error) => {
        if (err) {
          reject(err)
        }
      })
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res._getData(), [
      { tag: 'v2.0.0', sha: 'sha456' },
      { tag: 'v1.0.0', sha: 'sha123' }
    ])
    assert.strictEqual(
      (githubMock.rest as Record<string, Record<string, any>>).repos.listTags.calledOnce,
      true
    )
    assert.strictEqual(
      (githubMock.rest as Record<string, Record<string, any>>).git.getTag.called,
      true
    )
  })

  it('should handle /:login/:repo/revisions with annotated tags', async () => {
    ;(githubMock.rest as Record<string, Record<string, any>>).repos.listTags.resolves({
      data: [
        {
          name: 'v1.0.0',
          commit: { sha: 'tagSha1' }
        }
      ]
    })
    ;(githubMock.rest as Record<string, Record<string, any>>).git.getTag.resolves({
      data: { object: { sha: 'commitSha1' } }
    })

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World/revisions',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('node:events').EventEmitter })

    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve)
      res.on('error', reject)
      router.handle(req, res, (err: Error) => {
        if (err) {
          reject(err)
        }
      })
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res._getData(), [{ tag: 'v1.0.0', sha: 'commitSha1' }])
    assert.strictEqual(
      (githubMock.rest as Record<string, Record<string, any>>).repos.listTags.calledOnce,
      true
    )
    assert.strictEqual(
      (githubMock.rest as Record<string, Record<string, any>>).git.getTag.calledOnce,
      true
    )
  })

  it('should return empty array on 404 from GitHub', async () => {
    const notFoundError = new Error('Not Found') as Error & Record<string, unknown>
    notFoundError.code = 404
    notFoundError.status = 404

    ;(githubMock.rest as Record<string, Record<string, any>>).repos.listTags.rejects(notFoundError)

    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/octocat/Hello-World/revisions',
      params: { login: 'octocat', repo: 'Hello-World' },
      app: { locals: { service: { github: { client: githubMock } } } }
    })

    const res = httpMocks.createResponse({ eventEmitter: require('node:events').EventEmitter })

    await new Promise<void>((resolve, reject) => {
      res.on('end', resolve)
      res.on('error', reject)
      router.handle(req, res, (err: Error) => {
        if (err) {
          reject(err)
        }
      })
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res._getData(), [])
    assert.strictEqual(
      (githubMock.rest as Record<string, Record<string, any>>).repos.listTags.calledOnce,
      true
    )
  })
})

function loadFixture(path: string) {
  const body = fs.readFileSync(path)
  return JSON.parse(body)
}
