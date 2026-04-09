// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { expect } from 'chai'
import sinon from 'sinon'
import coordinatesMapper from '../../lib/coordinatesMapper.ts'
import EntityCoordinates from '../../lib/entityCoordinates.ts'

function pypiCoordinates(name: string) {
  return EntityCoordinates.fromString(`pypi/pypi/-/${name}/1.1.0a4`)
}

function fakeCache(cache: Record<string, EntityCoordinates>) {
  return {
    get: (key: string) => cache[key],
    set: (key: string, value: EntityCoordinates) => (cache[key] = value),
    size: () => Object.keys(cache).length
  }
}

describe('CoordinatesMapper', () => {
  it('return coordinate when no mapper', async () => {
    const coordinates = pypiCoordinates('0_core_client')
    const mapped = await coordinatesMapper({} as any).map(coordinates)
    expect(mapped).to.be.eq(coordinates)
  })

  it('use cache when available', async () => {
    const coordinates = pypiCoordinates('0_core_client')
    const cache: Record<string, EntityCoordinates> = {}
    cache[coordinates.toString()] = coordinates

    const mapper = coordinatesMapper({ pypi: {} } as any, fakeCache(cache) as any)
    const mapped = await mapper.map(coordinates)
    expect(mapped).to.be.eq(coordinates)
  })

  it('map then cache', async () => {
    const mapStub = sinon.stub().resolves(pypiCoordinates('0-core-client'))
    const cacheStub = fakeCache({}) as any
    const mapper = coordinatesMapper({ pypi: { map: mapStub } } as any, cacheStub)
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
    const mapped = await coordinatesMapper().map(undefined as any)
    expect(mapped).to.be.undefined
  })
})
