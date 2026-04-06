// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { expect } from 'chai'
import { SkipUpgradePolicy } from '../../../providers/upgrade/skipUpgradePolicy.js'

describe('SkipUpgradePolicy', () => {
  let policy

  beforeEach(() => {
    policy = new SkipUpgradePolicy()
  })

  it('returns the definition unchanged when passed a non-null definition', async () => {
    const definition = { _meta: { schemaVersion: '1.7.0' } }
    const result = await policy.validate(definition)
    expect(result).to.equal(definition)
  })

  it('returns null when passed null', async () => {
    const result = await policy.validate(null)
    expect(result).to.be.null
  })

  it('returns null when passed undefined', async () => {
    const result = await policy.validate(undefined)
    expect(result).to.be.null
  })
})
