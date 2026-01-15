// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const ListBasedFilter = require('../../../../providers/harvest/throttling/listBasedFilter')
const EntityCoordinates = require('../../../../lib/entityCoordinates')

const logger = {
  debug: () => {},
  error: () => {},
  warn: () => {}
}
describe('listBasedFilter', () => {
  it('isBlocked returns false when blacklist empty', () => {
    const filter = new ListBasedFilter({ blacklist: [], logger })
    const a = EntityCoordinates.fromString('npm/npmjs/-/left-pad/1.3.0')
    const b = EntityCoordinates.fromString('maven/mavencentral/org.slf4j/slf4j-api/2.0.12')
    expect(filter.isBlocked(a)).to.equal(false)
    expect(filter.isBlocked(b)).to.equal(false)
  })

  it('isBlocked returns true for versionless match', () => {
    const filter = new ListBasedFilter({ blacklist: ['git/github/org/name'], logger })
    const blocked = EntityCoordinates.fromString('git/github/org/name/1.0.0')
    const allowed_versioned = EntityCoordinates.fromString('maven/mavencentral/org.slf4j/slf4j-api/2.0.12')
    const allowed_versionless = EntityCoordinates.fromString('npm/npmjs/-/name')
    expect(filter.isBlocked(blocked)).to.equal(true)
    expect(filter.isBlocked(allowed_versioned)).to.equal(false)
    expect(filter.isBlocked(allowed_versionless)).to.equal(false)
  })

  it('isBlocked returns true for case insensitive github versionless match', () => {
    const filter = new ListBasedFilter({ blacklist: ['git/github/ORG/Name'], logger })
    const blocked_lower = EntityCoordinates.fromString('git/github/org/name/1.0.0')
    expect(filter.isBlocked(blocked_lower)).to.equal(true)
    const blocked_upper = EntityCoordinates.fromString('git/github/ORG/NAME/1.0.0')
    expect(filter.isBlocked(blocked_upper)).to.equal(true)
  })

  it('isBlocked returns true for versionless coordinates when matched.', () => {
    const filter = new ListBasedFilter({ blacklist: ['npm/npmjs/-/name'], logger })
    const blocked = EntityCoordinates.fromString('npm/npmjs/-/name')
    expect(filter.isBlocked(blocked)).to.equal(true)
  })

  it('isBlocked ignores incomplete coordinates in blacklist', () => {
    const filter = new ListBasedFilter({ blacklist: ['git'], logger })
    const allowed = EntityCoordinates.fromString('git/github/org/name/1.0.0')
    expect(filter.isBlocked(allowed)).to.equal(false)
  })
})
