const { expect } = require('chai')
const GitHubCurationService = require('../../providers/curation/github')
const Curation = require('../../lib/curation')
const sinon = require('sinon')
const extend = require('extend')
const { find } = require('lodash')

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

  it('merges simple changes', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => simpleCuration.revisions['1.0'])
    const base = { coordinates: definitionCoordinates }
    await service.apply(null, null, base)
    expect(base.described.projectWebsite).to.eq('http://foo.com')
  })

  it('merges complex curation on simple base', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => complexCuration.revisions['1.0'])
    const base = extend(true, {}, simpleHarvested)
    await service.apply(null, null, base)
    expect(base.described.releaseDate).to.eq('2018-10-19')
    expect(base.described.projectWebsite).to.eq('http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    expect(!!file1).to.be.true
    expect(file1.license).to.eq('MIT')
    const file2 = find(base.files, file => file.path === '2.txt')
    expect(!!file2).to.be.true
    expect(file2.license).to.eq('GPL')
  })

  it('merges simple curation on complex base', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => simpleCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvested)
    await service.apply(null, null, base)
    expect(base.described.releaseDate).to.eq('2018-08-09')
    expect(base.described.projectWebsite).to.eq('http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    expect(!!file1).to.be.true
    expect(file1.token).to.eq('1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    expect(!!file2).to.be.true
    expect(file2.token).to.eq('2 token')
  })

  it('merges complex structures', async () => {
    const service = createService()
    sinon.stub(service, 'get').callsFake(() => complexCuration.revisions['1.0'])
    const base = extend(true, {}, complexHarvested)
    await service.apply(null, null, base)
    expect(base.described.projectWebsite).to.eq('http://foo.com')
    const file1 = find(base.files, file => file.path === '1.txt')
    expect(!!file1).to.be.true
    expect(file1.license).to.eq('MIT')
    expect(file1.token).to.eq('1 token')
    const file2 = find(base.files, file => file.path === '2.txt')
    expect(!!file2).to.be.true
    expect(file2.license).to.eq('GPL')
    expect(file2.token).to.eq('2 token')
  })
})

const curationCoordinates = { type: 'npm', provider: 'npmjs', namespace: null, name: 'test' }
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

const simpleHarvested = {
  coordinates: definitionCoordinates
}

const complexHarvested = {
  coordinates: definitionCoordinates,
  described: { releaseDate: '2018-08-09' },
  files: [{ path: '2.txt', token: '2 token' }, { path: '1.txt', token: '1 token' }]
}

function createCuration() {
  return new Curation(simpleCuration)
}

function createInvalidCuration() {
  return new Curation({
    coordinates: {
      type: 'sdfdsf',
      provider: 'npmjs',
      namespace: null,
      name: 'test'
    }
  })
}
