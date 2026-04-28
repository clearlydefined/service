// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import { expect } from 'chai'
import sinon from 'sinon'
import type { RecomputeContext } from '../../../business/definitionService.ts'
import EntityCoordinates from '../../../lib/entityCoordinates.ts'
import { OnDemandComputePolicy } from '../../../providers/upgrade/onDemandComputePolicy.ts'

describe('OnDemandComputePolicy', () => {
  let policy

  beforeEach(() => {
    policy = new OnDemandComputePolicy()
  })

  it('is instanceof OnDemandComputePolicy', () => {
    expect(policy).to.be.instanceOf(OnDemandComputePolicy)
  })

  it('initialize() resolves without error', async () => {
    await expect(policy.initialize()).to.be.fulfilled
  })

  it('setupProcessing() resolves without error', async () => {
    await expect(policy.setupProcessing()).to.be.fulfilled
  })

  it('computes and delegates to computeStoreAndCurate', async () => {
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/leftpad/1.0.0')
    const definition = createDefinition(coordinates)
    const computeStoreAndCurate = sinon.stub().resolves(definition)
    const definitionService = { computeStoreAndCurate } as unknown as RecomputeContext

    const result = await policy.compute(definitionService, coordinates)

    expect(computeStoreAndCurate.calledOnceWithExactly(coordinates)).to.be.true
    expect(result).to.deep.equal(definition)
  })
})

function createDefinition(coordinates: EntityCoordinates) {
  return {
    coordinates,
    described: { tools: ['component'] },
    _meta: { schemaVersion: '1.7.0', updated: new Date().toISOString() }
  }
}
