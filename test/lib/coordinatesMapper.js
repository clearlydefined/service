// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const EntityCoordinates = require('../../lib/entityCoordinates')
const coordinatesMapper = require('../../lib/coordinatesMapper')

function pypiCoordinates(name) {
  return EntityCoordinates.fromString(`pypi/pypi/-/${name}/1.1.0a4`)
}

function fakeCache(cache) {
  return {
    get: key => cache[key],
    set: (key, value) => (cache[key] = value),
    size: () => Object.keys(cache).length
  }
}

describe('CoordinatesMapper', () => {
  it('return coordinate when no mapper', async () => {
    const coordinates = pypiCoordinates('0_core_client')
    const mapped = await coordinatesMapper({}).map(coordinates)
    expect(mapped).to.be.eq(coordinates)
  })

  it('use cache when available', async () => {
    const coordinates = pypiCoordinates('0_core_client')
    const cache = {}
    cache[coordinates.toString()] = coordinates

    const mapper = coordinatesMapper({ pypi: {} }, fakeCache(cache))
    const mapped = await mapper.map(coordinates)
    expect(mapped).to.be.eq(coordinates)
  })

  it('map then cache', async () => {
    const mapStub = sinon.stub().resolves(pypiCoordinates('0-core-client'))
    const cacheStub = fakeCache({})
    const mapper = coordinatesMapper({ pypi: { map: mapStub } }, cacheStub)
    const coordinates = pypiCoordinates('0_core_client')

    //cached after map
    let mapped = await mapper.map(coordinates)
    expect(mapped.name).to.be.eq('0-core-client')
    expect(mapStub.calledOnce).to.be.true
    expect(cacheStub.size()).to.be.eq(1)

    //2nd time, should use cache, map should not be called.
    mapped = await mapper.map(coordinates)
    expect(mapped.name).to.be.eq('0-core-client')
    expect(mapStub.calledOnce).to.be.true
    expect(cacheStub.size()).to.be.eq(1)
  })

  it('null check', async () => {
    const mapped = await coordinatesMapper().map()
    expect(mapped).to.be.undefined
  })
})
