// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict'

/**
 * Recursively sort arrays within a value so order-independent deep comparison works.
 * Objects are traversed recursively; arrays are sorted by JSON representation.
 */
function deepSortArrays(value: unknown): unknown {
  if (Array.isArray(value)) {
    const sorted = value.map(deepSortArrays)
    sorted.sort((a, b) => {
      const aStr = JSON.stringify(a)
      const bStr = JSON.stringify(b)
      if (aStr < bStr) return -1
      if (aStr > bStr) return 1
      return 0
    })
    return sorted
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      result[key] = deepSortArrays((value as Record<string, unknown>)[key])
    }
    return result
  }
  return value
}

/**
 * Assert deep equality ignoring array order.
 * Replaces chai's deep-equal-in-any-order plugin.
 */
export function assertDeepEqualInAnyOrder(actual: unknown, expected: unknown, message?: string): void {
  assert.deepStrictEqual(deepSortArrays(actual), deepSortArrays(expected), message)
}
