// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const MemorySearch = require('../../../providers/search/memory')

describe('memory search tests', () => {
  const searches = {
    'npmjs/red': 'npm/npmjs/-/redis/0.1.0',
    'github/bit': 'git/github/bitflags/bitflags/518aaf91494e94f41651a40f1b38d6ab522b0235',
    'mavencentral/org.apache': 'maven/mavencentral/org.apache.httpcomponents/httpcore/4.1',
    'nuget/xunit': 'nuget/nuget/-/xunit.core/2.4.1',
    'pypi/back': 'pypi/pypi/-/backports.ssl_match_hostname/3.7.0.1',
    'rubygems/sma': 'gem/rubygems/-/small/0.4',
    'cratesio/bit': 'crate/cratesio/-/bitflags/1.0.4',
    'debian/0a': 'deb/debian/-/0ad/0.0.17-1_amd64',
    'packagist/sym': 'composer/packagist/symfony/polyfill-mbstring/1.11.0',
    'cocoapods/soft': 'pod/cocoapods/-/SoftButton/0.1.0'
  }

  let memorySearch
  before(() =>{
    const definitions = Object.values(searches)
      .map(EntityCoordinates.fromString)
      .map(coordinates => ({ coordinates }))

    memorySearch = MemorySearch({})
    memorySearch.store(definitions)
  })

  it('should search successfully', async () => {
    Object.entries(searches).forEach(async ([key, value]) => {
      const result = await memorySearch.suggestCoordinates(key)
      expect(result[0]).to.be.equal(value)
    })
  })
})