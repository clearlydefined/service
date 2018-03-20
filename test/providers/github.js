const { expect } = require('chai')
const GitHubCurationService = require('../../providers/curation/github')
const Curation = require('../../lib/curation')
const sinon = require('sinon')

function createService(definitionService = null, endpoints = { website: 'http://localhost:3000' }) {
  return GitHubCurationService(
    {
      owner: 'foobar',
      repo: 'foobar',
      branch: 'foobar',
      token: 'foobar',
      tempLocation: '.'
    },
    endpoints,
    definitionService
  )
}

describe('Github Curation Service', () => {
  it('invalidates coordinates when handling merge', async () => {
    const definitionService = { invalidate: sinon.stub().returns(Promise.resolve(null)) }
    const service = createService(definitionService)
    sinon.stub(service, 'getCurations').callsFake(() => {
      return [createCuration()]
    })
    await service.handleMerge(1, 42)
    expect(definitionService.invalidate.calledOnce).to.be.true
    expect(definitionService.invalidate.getCall(0).args[0][0].name).to.be.eq('test')
  })

  it('validates valid PR change', async () => {
    const service = createService()
    sinon.stub(service, 'postCommitStatus').returns(Promise.resolve())
    sinon.stub(service, 'getCurations').callsFake(() => {
      return [createCuration()]
    })
    await service.validateCurations(1, 'npm/npmjs/-/test', '42', 'testBranch')
    expect(service.postCommitStatus.calledTwice).to.be.true
    expect(service.postCommitStatus.getCall(0).args[3]).to.be.eq('pending')
    expect(service.postCommitStatus.getCall(1).args[3]).to.be.eq('success')
  })

  it('validates invalid PR change', async () => {
    const service = createService()
    sinon.stub(service, 'postCommitStatus').returns(Promise.resolve())
    sinon.stub(service, 'getCurations').callsFake(() => {
      return [createInvalidCuration()]
    })
    await service.validateCurations(1, 'npm/npmjs/-/test', '42', 'testBranch')
    expect(service.postCommitStatus.calledTwice).to.be.true
    expect(service.postCommitStatus.getCall(0).args[3]).to.be.eq('pending')
    expect(service.postCommitStatus.getCall(1).args[3]).to.be.eq('error')
  })
})

function createCuration() {
  return new Curation(null, {
    coordinates: {
      type: 'npm',
      provider: 'npmjs',
      namespace: null,
      name: 'test'
    },
    revisions: {
      '1.0': {
        described: {
          projectWebsite: 'http://foo.com'
        }
      }
    }
  })
}

function createInvalidCuration() {
  return new Curation(null, {
    coordinates: {
      type: 'sdfdsf',
      provider: 'npmjs',
      namespace: null,
      name: 'test'
    }
  })
}
