// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const ListBasedFilter = require('../../../../providers/harvest/throttling/listBasedFilter')
const EntityCoordinates = require('../../../../lib/entityCoordinates')

const mockLogger = {
  debug: () => {},
  error: () => {},
  warn: () => {}
}
describe('listBasedFilter', () => {
  it('isBlocked returns false when blacklist empty', () => {
    const filter = new ListBasedFilter({ blacklist: [], logger: mockLogger })
    const a = EntityCoordinates.fromString('npm/npmjs/-/left-pad/1.3.0')
    const b = EntityCoordinates.fromString('maven/mavencentral/org.slf4j/slf4j-api/2.0.12')
    expect(filter.isBlocked(a)).to.equal(false)
    expect(filter.isBlocked(b)).to.equal(false)
  })

  it('isBlocked returns true for versionless match', () => {
    const filter = new ListBasedFilter({ blacklist: ['git/github/org/name'], logger: mockLogger })
    const blocked = EntityCoordinates.fromString('git/github/org/name/1.0.0')
    const allowed = EntityCoordinates.fromString('maven/mavencentral/org.slf4j/slf4j-api/2.0.12')
    expect(filter.isBlocked(blocked)).to.equal(true)
    expect(filter.isBlocked(allowed)).to.equal(false)
  })

  it('isBlocked ignores incomplete coordinates', () => {
    const filter = new ListBasedFilter({ blacklist: ['git'], logger: mockLogger })
    const allowed = EntityCoordinates.fromString('git/github/org/name/1.0.0')
    expect(filter.isBlocked(allowed)).to.equal(false)
  })
})
