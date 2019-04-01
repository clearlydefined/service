// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const StatsService = require('../../business/statsService')

describe('Stats Service', () => {
  it('calculates median score given frequency table', () => {
    const input = [
      { count: 14818, to: 10 },
      { count: 4224, from: 10, to: 20 },
      { count: 607, from: 20, to: 30 },
      { count: 298, from: 30, to: 40 },
      { count: 5810, from: 40, to: 50 },
      { count: 1117, from: 50, to: 60 },
      { count: 14959, from: 60, to: 70 },
      { count: 30633, from: 70, to: 80 },
      { count: 2354, from: 80, to: 90 },
      { count: 320, from: 90, to: 100 },
      { count: 60, from: 100 }
    ]
    const result = StatsService()._getMedian(input, 75200)
    expect(result).to.eq(70)
  })

  it('calculates 0 median score for 0 totalCount', () => {
    const input = []
    const result = StatsService()._getMedian(input, 0)
    expect(result).to.eq(0)
  })
})
