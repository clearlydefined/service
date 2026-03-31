import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import StatsService from '../../business/statsService.js'

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
    const service = (StatsService as (...args: any[]) => any)() as Record<string, (...args: any[]) => any>
    const result = service._getMedian(input, 3288)
    assert.strictEqual(result, 3)
  })

  it('calculates 0 median score for 0 totalCount', () => {
    const input: { count: number; value: number }[] = []
    const service = (StatsService as (...args: any[]) => any)() as Record<string, (...args: any[]) => any>
    const result = service._getMedian(input, 0)
    assert.strictEqual(result, 0)
  })
})
