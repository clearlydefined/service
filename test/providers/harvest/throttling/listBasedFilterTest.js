// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const ListBasedFilter = require('../../../../providers/harvest/throttling/listBasedFilter')
const EntityCoordinates = require('../../../../lib/entityCoordinates')

describe('ListBasedFilter', () => {
  const logger = {
    debug: () => {},
    error: () => {},
    warn: () => {}
  }

  function createCoord(coordString) {
    return EntityCoordinates.fromString(coordString)
  }

  describe('isBlocked', () => {
    describe('empty blacklist', () => {
      it('should return false for any coordinate', () => {
        const filter = new ListBasedFilter({ blacklist: [], logger })

        expect(filter.isBlocked(createCoord('npm/npmjs/-/left-pad/1.3.0'))).to.be.false
        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-api/2.0.12'))).to.be.false
      })
    })

    describe('versionless matching', () => {
      let filter
      before(() => {
        filter = new ListBasedFilter({ blacklist: ['git/github/org/name'], logger })
      })
      it('should block matching coordinates regardless of revision', () => {
        expect(filter.isBlocked(createCoord('git/github/org/name/1.0.0'))).to.be.true
        expect(filter.isBlocked(createCoord('git/github/org/name'))).to.be.true
      })

      it('should not block non-matching coordinates', () => {
        expect(filter.isBlocked(createCoord('git/github/org/name2/1.0.0'))).to.be.false
        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-api/2.0.12'))).to.be.false
        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-api'))).to.be.false
      })
    })

    describe('case-insensitive matching', () => {
      it('should match GitHub coordinates case-insensitively', () => {
        const filter = new ListBasedFilter({ blacklist: ['git/github/ORG/Name'], logger })

        expect(filter.isBlocked(createCoord('git/github/org/name/1.0.0'))).to.be.true
        expect(filter.isBlocked(createCoord('git/github/ORG/NAME/1.0.0'))).to.be.true
      })
    })

    describe('multiple blacklist entries', () => {
      let filter
      before(() => {
        filter = new ListBasedFilter({
          blacklist: ['npm/npmjs/-/lodash', 'maven/mavencentral/org.apache/commons-lang3', 'git/github/test/repo'],
          logger
        })
      })
      it('should block all matching coordinates', () => {
        expect(filter.isBlocked(createCoord('npm/npmjs/-/lodash/4.17.21'))).to.be.true
        expect(filter.isBlocked(createCoord('maven/mavencentral/org.apache/commons-lang3/3.12.0'))).to.be.true
        expect(filter.isBlocked(createCoord('git/github/test/repo/abc123'))).to.be.true
      })

      it('should not block non-matching coordinates', () => {
        expect(filter.isBlocked(createCoord('npm/npmjs/-/express/4.18.0'))).to.be.false
      })
    })

    describe('different coordinate types', () => {
      it('should handle pypi, nuget, and gem coordinates', () => {
        const filter = new ListBasedFilter({
          blacklist: ['pypi/pypi/-/requests', 'nuget/nuget/-/Newtonsoft.Json', 'gem/rubygems/-/rails'],
          logger
        })

        expect(filter.isBlocked(createCoord('pypi/pypi/-/requests/2.28.0'))).to.be.true
        expect(filter.isBlocked(createCoord('nuget/nuget/-/Newtonsoft.Json/13.0.1'))).to.be.true
        expect(filter.isBlocked(createCoord('gem/rubygems/-/rails/7.0.0'))).to.be.true
        expect(filter.isBlocked(createCoord('pypi/pypi/-/django/4.0.0'))).to.be.false
      })
    })

    describe('namespace handling', () => {
      it('should match Maven coordinates with proper namespace', () => {
        const filter = new ListBasedFilter({ blacklist: ['maven/mavencentral/org.slf4j/slf4j-api'], logger })

        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-api/2.0.12'))).to.be.true
        expect(filter.isBlocked(createCoord('maven/mavencentral/org.slf4j/slf4j-simple/2.0.12'))).to.be.false
        expect(filter.isBlocked(createCoord('maven/mavencentral/com.google/guava/31.0'))).to.be.false
      })
    })

    describe('edge cases', () => {
      it('should return false for null or undefined coordinates', () => {
        const filter = new ListBasedFilter({ blacklist: ['npm/npmjs/-/test'], logger })

        expect(filter.isBlocked(null)).to.be.false
        expect(filter.isBlocked(undefined)).to.be.false
      })
    })
  })

  describe('constructor', () => {
    describe('invalid coordinates handling', () => {
      it('should ignore incomplete coordinates and log warnings', () => {
        const filter = new ListBasedFilter({ blacklist: ['git/github'], logger })

        expect(filter.isBlocked(createCoord('git/github/org/name/1.0.0'))).to.be.false
      })

      it('should log warnings for invalid coordinates', () => {
        const warnings = []
        const mockLogger = {
          debug: () => {},
          error: () => {},
          warn: msg => warnings.push(msg)
        }

        new ListBasedFilter({
          blacklist: ['git/github', 'invalid', 'npm/npmjs/-/valid'],
          logger: mockLogger
        })

        expect(warnings.length).to.be.greaterThan(0)
        expect(warnings.some(w => w.includes('git/github'))).to.be.true
        expect(warnings.some(w => w.includes('invalid'))).to.be.true
      })
    })
  })
})
