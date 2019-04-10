// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const StatsService = require('../../business/statsService')

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
})
