// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const EntityCoordinates = require('../../lib/entityCoordinates')
const PypiCoordinatesMapper = require('../../lib/pypiCoordinatesMapper')

function mockPypiCoordinates(name) {
  return EntityCoordinates.fromString(`pypi/pypi/-/${name}/1.1.0a4`)
}

describe('PypiCoordinatesMapper', () => {

  it('name containing "_" mapped to "-"', async () => {
    const coordinatesMapper = new PypiCoordinatesMapper()
    sinon.stub(coordinatesMapper, '_resolve').resolves({ name: '0-core-client' })
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0_core_client'))
    expect(mapped.name).to.be.eq('0-core-client')
  })

  it('name containing "." mapped to "-"', async () => {
    const coordinatesMapper = new PypiCoordinatesMapper()
    sinon.stub(coordinatesMapper, '_resolve').resolves({ name: '0-core-client' })
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0.core_client'))
    expect(mapped.name).to.be.eq('0-core-client')
  })

  it('name containing "-" mapped to "_"', async () => {
    const coordinatesMapper = new PypiCoordinatesMapper()
    sinon.stub(coordinatesMapper, '_resolve').resolves({ name: 'backports.ssl_match_hostname' })
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('Backports.ssl-match-hostname'))
    expect(mapped.name).to.be.eq('backports.ssl_match_hostname')
  })

  it('name not resolved', async () => {
    const coordinatesMapper = new PypiCoordinatesMapper()
    sinon.stub(coordinatesMapper, '_resolve').resolves(undefined)
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0_core_client'))
    expect(mapped).to.be.undefined
  })

  it('no mapping necessary', async () => {
    const coordinatesMapper = new PypiCoordinatesMapper()
    sinon.stub(coordinatesMapper, '_resolve').rejects('Should not be called')
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('backports'))
    expect(mapped).to.be.null
  })
})


