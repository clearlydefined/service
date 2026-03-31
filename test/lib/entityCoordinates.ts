// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import EntityCoordinates from '../../lib/entityCoordinates.js'

describe('EntityCoordinates', () => {
  it('should have type and provider in lower case', () => {
    const coordinates = new EntityCoordinates('TYPE', 'PROVIDER', 'NAMESPACE', 'NAME', 'REVISION')
    assert.strictEqual(coordinates.type, 'type')
    assert.strictEqual(coordinates.provider, 'provider')
  })

  it('test empty', () => {
    const coordinates = new EntityCoordinates()
    assert.notStrictEqual(coordinates.toString(), null)
  })

  it('github coordinates should have namespace and name in lower case', () => {
    const coordinates = new EntityCoordinates('git', 'GITHUB', 'NAMESPACE', 'NAME', 'REVISION')
    assert.strictEqual(coordinates.provider, 'github')
    assert.strictEqual(coordinates.namespace, 'namespace')
    assert.strictEqual(coordinates.name, 'name')
  })

  it('pypi coordinates should have name in lower case', () => {
    const coordinates = new EntityCoordinates('pypi', 'pypi', '-', 'NAME', 'REVISION')
    assert.strictEqual(coordinates.name, 'name')
  })
})
