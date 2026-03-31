// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import PypiCoordinatesMapper from '../../lib/pypiCoordinatesMapper.js'

function mockPypiCoordinates(name: string) {
  const spec = { type: 'pypi', provider: 'pypi', revision: '1.0.0', name }
  return EntityCoordinates.fromObject(spec)
}

function mockPypiAnswer(name: string) {
  return { info: { name } }
}

describe('PypiCoordinatesMapper', () => {
  let coordinatesMapper: any
  let fetchStub: ReturnType<typeof mock.fn>
  beforeEach(() => {
    fetchStub = mock.fn()
    coordinatesMapper = new PypiCoordinatesMapper(fetchStub)
  })

  it('should map name containing "_" mapped to "-"', async () => {
    fetchStub.mock.mockImplementation(async () => mockPypiAnswer('0-core-client'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0_core_client'))
    assert.strictEqual(mapped.name, '0-core-client')
  })

  it('should map name containing "." mapped to "-"', async () => {
    fetchStub.mock.mockImplementation(async () => mockPypiAnswer('0-core-client'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0.core_client'))
    assert.strictEqual(mapped.name, '0-core-client')
  })

  it('should map name containing "-" mapped to "_"', async () => {
    fetchStub.mock.mockImplementation(async () => mockPypiAnswer('backports.ssl_match_hostname'))
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('Backports.ssl-match-hostname'))
    assert.strictEqual(mapped.name, 'backports.ssl_match_hostname')
  })

  it('should return null when pypi api returns 404', async () => {
    fetchStub.mock.mockImplementation(() => {
      throw { statusCode: 404 }
    })
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('blivet-gui'))
    assert.strictEqual(mapped, null)
  })

  it('should handle name not resolved', async t => {
    t.mock.method(coordinatesMapper, '_resolve', async () => undefined)
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('0_core_client'))
    assert.strictEqual(mapped, undefined)
  })

  it('should handle no mapping necessary', async t => {
    t.mock.method(coordinatesMapper, '_resolve', async () => {
      throw new Error('Should not be called')
    })
    const mapped = await coordinatesMapper.map(mockPypiCoordinates('backports'))
    assert.strictEqual(mapped, null)
  })

  describe('should handle invalid package names and skip network calls', () => {
    beforeEach(() =>
      fetchStub.mock.mockImplementation(() => {
        throw new Error('Should not be called')
      })
    )

    it('should return null for an invalid name', async () => handleInvalidName(coordinatesMapper, 'backports./test'))

    it('should return null when the name is ..', async () => handleInvalidName(coordinatesMapper, '..'))

    it('should return null for no name', async () => handleInvalidName(coordinatesMapper, undefined as any))
  })
})

async function handleInvalidName(coordinatesMapper: any, name: string) {
  const mapped = await coordinatesMapper.map(mockPypiCoordinates(name))
  assert.strictEqual(mapped, null)
}
