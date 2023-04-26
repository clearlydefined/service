// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const StatsService = require('../../business/statsService')
const sinon = require('sinon')

describe('Stats Service', () => {
  it('calculates median score given frequency table', () => {
    const input = [
      { count: 952, value: 0 },
      { count: 354, value: 1 },
      { count: 217, value: 2 },
      { count: 196, value: 3 },
      { count: 181, value: 4 },
      { count: 90, value: 5 },
      { count: 83, value: 6 },
      { count: 79, value: 7 },
      { count: 75, value: 8 },
      { count: 22, value: 9 },
      { count: 1039, value: 10 }
    ]
    const result = StatsService()._getMedian(input, 3288)
    expect(result).to.eq(3)
  })

  it('calculates 0 median score for 0 totalCount', () => {
    const input = []
    const result = StatsService()._getMedian(input, 0)
    expect(result).to.eq(0)
  })
  
  describe('fetch stat', () => {
    const fetchedStats = {
      totalCount: 0, 
      describedScores: [], 
      licensedScores: [], 
      declaredLicenses: []
    }
    const computedStats = {
      'totalCount': 16,
      'describedScoreMedian': 100,
      'licensedScoreMedian': 69,
      'declaredLicenseBreakdown': [
        {
          'count': 12,
          'value': 'MIT'
        },
        {
          'count': 4,
          'value': 'Other'
        }
      ]
    }

    let cache, statsProvider, statsService
    
    beforeEach(() => {
      cache = {
        get: sinon.stub(),
        set: sinon.stub()
      }
      statsProvider = {
        fetchStats: sinon.stub()
      }
      statsService = StatsService(null, statsProvider, cache)
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should trigger fetch with the right arguments when not cached', async () => {
      cache.get.resolves(null)
      statsProvider.fetchStats.resolves(fetchedStats)
      const result = await statsService.get('composer')
      expect(result).to.be.ok
      expect(statsProvider.fetchStats.firstCall.args).to.be.deep.equal(['composer', true])
    })

    it('should trigger fetch without licenses when not cached', async () => {
      cache.get.resolves(null)
      statsProvider.fetchStats.resolves(fetchedStats)
      const result = await statsService.get('composer', { withLicenses : false })
      expect(result).to.be.ok
      expect(statsProvider.fetchStats.firstCall.args).to.be.deep.equal(['composer', false])
    })

    it('should use cache when cached', async () => {
      cache.get.resolves(computedStats)
      statsProvider.fetchStats.rejects('should not be called')
      const result = await statsService.get('composer')
      expect(result).to.be.deep.equal(computedStats)
      expect(statsProvider.fetchStats.callCount).to.be.equal(0)
    })

    it('should use cache when licensed cache available', async () => {
      cache.get
        .withArgs('stat_composer_no_licenses').resolves(null)
        .withArgs('stat_composer').resolves(computedStats)
      statsProvider.fetchStats.rejects('should not be called')
      const result = await statsService.get('composer', { withLicenses : false })
      expect(result).to.be.deep.equal({ ...computedStats, declaredLicenseBreakdown: [] })
      expect(statsProvider.fetchStats.callCount).to.be.equal(0)
    })      
  })
})
