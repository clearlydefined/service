// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const EntityCoordinates = require('../../lib/entityCoordinates')

describe('EntityCoordinates', () => {
  it('should have type and provider in lower case', () => {
    const coordinates = new EntityCoordinates('TYPE', 'PROVIDER', 'NAMESPACE', 'NAME', 'REVISION')
    expect(coordinates.type).to.be.eq('type')
    expect(coordinates.provider).to.be.eq('provider')
  })

  it('test empty', () => {
    const coordinates = new EntityCoordinates()
    expect(coordinates.toString()).to.be.not.null
  })

  it('github coordinates should have namespace and name in lower case', () => {
    const coordinates = new EntityCoordinates('git', 'GITHUB', 'NAMESPACE', 'NAME', 'REVISION')
    expect(coordinates.provider).to.be.eq('github')
    expect(coordinates.namespace).to.be.eq('namespace')
    expect(coordinates.name).to.be.eq('name')
  })

  it('pypi coordinates should have name in lower case', () => {
    const coordinates = new EntityCoordinates('pypi', 'pypi', '-', 'NAME', 'REVISION')
    expect(coordinates.name).to.be.eq('name')
  })
})
