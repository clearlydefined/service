// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const EntityCoordinates = require('../../../../lib/entityCoordinates')
const proxyquire = require('proxyquire')

describe('ListBasedFilterConfig', () => {
  // Stub the logger used by the module to avoid initialization issues
  const factory = proxyquire('../../../../providers/harvest/throttling/listBasedFilterConfig', {
    '../../logging/logger': () => ({
      debug: () => {},
      error: () => {},
      warn: () => {}
    })
  })

  function createCoord(coordString) {
    return EntityCoordinates.fromString(coordString)
  }

  describe('factory function', () => {
    describe('with empty blacklist', () => {
      it('should not block any coordinates when given "[]"', () => {
        const filter = factory('[]')

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-api/2.0.12'))).to.be.false
      })
    })

    describe('with valid JSON array', () => {
      it('should block coordinates matching blacklist entries', () => {
        const filter = factory(JSON.stringify(['npm/npmjs/-/left-pad', 'git/github/org/name']))

        expect(filter.isBlocked(createCoord('git/github/org/name/1.0.0'))).to.be.true
        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.true
      })

      it('should not block coordinates not in blacklist', () => {
        const filter = factory(JSON.stringify(['npm/npmjs/-/left-pad', 'git/github/org/name']))

        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-api/2.0.12'))).to.be.false
      })
    })

    describe('with invalid input', () => {
      it('should default to empty blacklist for non-JSON string', () => {
        const filter = factory('npm/npmjs/-/left-pad')

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-api/2.0.12'))).to.be.false
      })

      it('should default to empty blacklist for malformed JSON', () => {
        const filter = factory('{invalid json}')

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
      })

      it('should default to empty blacklist for non-array JSON', () => {
        const filter = factory('{"key": "value"}')

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
      })

      it('should default to empty blacklist for null', () => {
        const filter = factory(null)

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
      })

      it('should default to empty blacklist for undefined', () => {
        const filter = factory(undefined)

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
      })

      it('should default to empty blacklist for empty string', () => {
        const filter = factory('')

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
      })
    })
  })
})
