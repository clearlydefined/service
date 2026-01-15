// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const EntityCoordinates = require('../../../../lib/entityCoordinates')
const proxyquire = require('proxyquire')
// Stub the logger used by the module to avoid initialization issues
const factory = proxyquire('../../../../providers/harvest/throttling/listBasedFilterConfig', {
  '../../logging/logger': () => ({
    debug: () => {},
    error: () => {},
    warn: () => {}
  })
})

describe('listBasedFilterConfig', () => {
  it('defaults to empty list when given "[]"', async () => {
    const filter = factory('[]')
    const a = EntityCoordinates.fromString('npm/npmjs/-/left-pad/1.3.0')
    const b = EntityCoordinates.fromString('maven/mavencentral/org.slf4j/slf4j-api/2.0.12')
    expect(filter.isBlocked(a)).to.equal(false)
    expect(filter.isBlocked(b)).to.equal(false)
  })

  it('applies blacklist entries when given a JSON array string', async () => {
    const filter = factory(JSON.stringify(['npm/npmjs/-/left-pad', 'git/github/org/name']))
    const blocked1 = EntityCoordinates.fromString('git/github/org/name/1.0.0')
    const blocked2 = EntityCoordinates.fromString('npm/npmjs/-/left-pad/1.3.0')
    const allowed = EntityCoordinates.fromString('maven/mavencentral/org.slf4j/slf4j-api/2.0.12')
    expect(filter.isBlocked(blocked1)).to.equal(true)
    expect(filter.isBlocked(blocked2)).to.equal(true)
    expect(filter.isBlocked(allowed)).to.equal(false)
  })

  it('ignores non-JSON', async () => {
    const filter = factory('npm/npmjs/-/left-pad')
    const a = EntityCoordinates.fromString('npm/npmjs/-/left-pad/1.3.0')
    const b = EntityCoordinates.fromString('maven/mavencentral/org.slf4j/slf4j-api/2.0.12')
    expect(filter.isBlocked(a)).to.equal(false)
    expect(filter.isBlocked(b)).to.equal(false)
  })
})
