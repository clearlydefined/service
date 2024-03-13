// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const EntityCoordinates = require('../../lib/entityCoordinates')
const PypiCoordinatesMapper = require('../../lib/pypiCoordinatesMapper')

function mockPypiCoordinates(name) {
  const spec = { type: 'pypi', provider: 'pypi', revision: '1.0.0', name }
  return EntityCoordinates.fromObject(spec)
}

function mockPypiAnswer(name) {
  return { info: { name } }
}

describe('PypiCoordinatesMapper', () => {
  let coordinatesMapper
  let fetchStub
  beforeEach(() => {
    fetchStub = sinon.stub()
    coordinatesMapper = new PypiCoordinatesMapper(fetchStub)
  })

  it('should map name containing "_" mapped to "-"', async () => {
    fetchStub.resolves(mockPypiAnswer('0-core-client'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0_core_client'))
    expect(mapped.name).to.be.eq('0-core-client')
  })

  it('should map name containing "." mapped to "-"', async () => {
    fetchStub.resolves(mockPypiAnswer('0-core-client'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0.core_client'))
    expect(mapped.name).to.be.eq('0-core-client')
  })

  it('should map name containing "-" mapped to "_"', async () => {
    fetchStub.resolves(mockPypiAnswer('backports.ssl_match_hostname'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('Backports.ssl-match-hostname'))
    expect(mapped.name).to.be.eq('backports.ssl_match_hostname')
  })

  it('should return null when pypi api returns 404', async () => {
    fetchStub.throws({ statusCode: 404 })
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('blivet-gui'))
    expect(mapped).to.be.null
  })

  it('should handle name not resolved', async () => {
    sinon.stub(coordinatesMapper, '_resolve').resolves(undefined)
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0_core_client'))
    expect(mapped).to.be.undefined
  })

  it('should handle no mapping necessary', async () => {
    sinon.stub(coordinatesMapper, '_resolve').rejects('Should not be called')
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('backports'))
    expect(mapped).to.be.null
  })

  describe('should handle invalid package names and skip network calls', () => {
    beforeEach(() => fetchStub.rejects('Should not be called'))

    it('should return null for an invalid name', async () => handleInvalidName(coordinatesMapper, 'backports./test'))

    it('should return null when the name is ..', async () => handleInvalidName(coordinatesMapper, '..'))

    it('should return null for no name', async () => handleInvalidName(coordinatesMapper))
  })
})

async function handleInvalidName(coordinatesMapper, name) {
  const mapped = await coordinatesMapper.map(mockPypiCoordinates(name))
  expect(mapped).to.be.null
}
