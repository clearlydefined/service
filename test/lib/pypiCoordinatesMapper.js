// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const EntityCoordinates = require('../../lib/entityCoordinates')
const PypiCoordinatesMapper = require('../../lib/pypiCoordinatesMapper')

function mockPypiCoordinates(name) {
  return EntityCoordinates.fromString(`pypi/pypi/-/${name}/1.1.0a4`)
}

function mockPypiAnswer(name) {
  return { info: { name } }
}

describe('PypiCoordinatesMapper', () => {
  let coordinatesMapper
  beforeEach(() => {
    coordinatesMapper = new PypiCoordinatesMapper()
  })

  it('should map name containing "_" mapped to "-"', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').resolves(mockPypiAnswer('0-core-client'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0_core_client'))
    expect(mapped.name).to.be.eq('0-core-client')
  })

  it('should map name containing "." mapped to "-"', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').resolves(mockPypiAnswer('0-core-client'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0.core_client'))
    expect(mapped.name).to.be.eq('0-core-client')
  })

  it('should map name containing "-" mapped to "_"', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').resolves(mockPypiAnswer('backports.ssl_match_hostname'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('Backports.ssl-match-hostname'))
    expect(mapped.name).to.be.eq('backports.ssl_match_hostname')
  })

  it('should return null when pypi api returns 404', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').throws({ statusCode: 404 })
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
  
  it('should return null when pypi name to be mapped is invalid', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').rejects('Should not be called')
    const spec = {
      type: 'pypi',
      provider: 'pypi',
      name: 'back.ports/test',
      revision: '1.0.0'
    }
    const coordinates = EntityCoordinates.fromObject(spec)
    const mapped = await coordinatesMapper.map(coordinates)
    expect(mapped).to.be.null
  })

  it('should return null given no name', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').rejects('Should not be called')
    const spec = {
      type: 'pypi',
      provider: 'pypi'
    }
    const coordinates = EntityCoordinates.fromObject(spec)
    const mapped = await coordinatesMapper.map(coordinates)
    expect(mapped).to.be.null
  })
})


