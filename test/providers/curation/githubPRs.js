const { expect } = require('chai')
const CurationStore = require('../../../providers/curation/memoryStore')
const Curation = require('../../../lib/curation')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const sandbox = sinon.createSandbox()
const yaml = require('js-yaml')
const base64 = require('base-64')

const curationCoordinates = { type: 'npm', provider: 'npmjs', name: 'test' }
const definitionCoordinates = { ...curationCoordinates, revision: '1.0' }

const simpleCuration = {
  coordinates: curationCoordinates,
  revisions: {
    '1.0': {
      described: { projectWebsite: 'http://foo.com' }
    }
  }
}

const complexCuration = {
  coordinates: curationCoordinates,
  revisions: {
    '1.0': {
      described: { releaseDate: '2018-10-19', projectWebsite: 'http://foo.com' },
      files: [{ path: '1.txt', license: 'MIT' }, { path: '2.txt', license: 'GPL' }]
    }
  }
}

const files = {
  'curations/npm/npmjs/-/foo.yaml': { sha: 42, content: complexCuration }
}

const prs = {
  12: { head: { ref: 'master', sha: '32' }, files: [{ filename: 'curations/npm/npmjs/-/foo.yaml' }] }
}

let Service
describe('Curation service pr events', () => {
  beforeEach(function() {
    const requestStub = () => {
      return Promise.resolve({ statusCode: 200 })
    }
    Service = proxyquire('../../../providers/curation/github', { 'request-promise-native': requestStub })
  })

  afterEach(function() {
    sandbox.restore()
  })

  it('handles open', async () => {
    const service = createService()
    const spy = sinon.spy(service.store, 'updateContribution')
    service.github = {
      pullRequests: {
        getFiles: ({ number }) => {
          return { data: prs[number].files }
        },
        get: ({ number }) => {
          return { data: { head: prs[number].head } }
        }
      },
      repos: {
        getContent: ({ path }) => {
          return {
            data: {
              sha: files[path].sha,
              content: base64.encode(yaml.safeDump(files[path].content, { sortKeys: true, lineWidth: 150 }))
            }
          }
        }
      }
    }
    await service.prOpened({ number: 12, head: prs[12].head })
    expect(spy.calledOnce).to.be.true
    expect(spy.args[0][0].number).to.be.equal(12)
    const data = spy.args[0][1].map(curation => curation.data)
    expect(data).to.be.deep.equalInAnyOrder([files['curations/npm/npmjs/-/foo.yaml'].content])
  })
})

function createService(definitionService = null, endpoints = { website: 'http://localhost:3000' }) {
  const store = CurationStore({})
  sinon.spy(store, 'updateContribution')
  sinon.spy(store, 'updateCurations')
  sinon.spy(store, 'list')
  return Service(
    {
      owner: 'foobar',
      repo: 'foobar',
      branch: 'foobar',
      token: 'foobar'
    },
    CurationStore({}),
    endpoints,
    definitionService
  )
}

function createCurationString(curation) {
  return yaml.safeDump(curation, { sortKeys: true, lineWidth: 150 })
}

const simpleHarvested = {
  coordinates: definitionCoordinates
}

const complexHarvested = {
  coordinates: definitionCoordinates,
  described: { releaseDate: '2018-08-09' },
  files: [{ path: '2.txt', token: '2 token' }, { path: '1.txt', token: '1 token' }]
}

function createInvalidCuration() {
  return new Curation({
    coordinates: {
      type: 'sdfdsf',
      provider: 'npmjs',
      name: 'test'
    }
  })
}
