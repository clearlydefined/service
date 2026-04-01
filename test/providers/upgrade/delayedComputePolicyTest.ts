// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import { expect } from 'chai'
import sinon from 'sinon'
import type { Definition, DefinitionService, RecomputeContext } from '../../../business/definitionService.js'
import EntityCoordinates from '../../../lib/entityCoordinates.js'
import type { IQueue } from '../../../providers/queueing/index.js'
import { DelayedComputePolicy } from '../../../providers/upgrade/delayedComputePolicy.js'
import { createMockLogger } from '../../helpers/mockLogger.ts'

const TEST_COORDINATES = 'npm/npmjs/-/leftpad/1.0.0'

describe('DelayedComputePolicy', () => {
  let queue: { [K in keyof IQueue]: sinon.SinonStub }
  let policy: DelayedComputePolicy
  let coordinates: EntityCoordinates

  beforeEach(async () => {
    queue = createQueue()
    policy = new DelayedComputePolicy({ logger: createMockLogger(), queue: () => queue })
    coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    await policy.initialize()
  })

  describe('compute()', () => {
    it('throws if called before initialize()', async () => {
      const uninitializedPolicy = new DelayedComputePolicy({
        logger: createMockLogger(),
        queue: () => queue
      })

      await expect(uninitializedPolicy.compute(definitionService(), coordinates)).to.be.rejectedWith(
        'DelayedComputePolicy.initialize() must be called before compute()'
      )
    })

    it('enqueues coordinates and returns placeholder definition', async () => {
      const result = await policy.compute(definitionService(), coordinates)
      validateEmptyDefinition(result, coordinates)
      validateQueuedCoordinates(queue, coordinates)
    })

    it('propagates enqueue error', async () => {
      const enqueueError = new Error('compute queue unavailable')
      queue.queue.rejects(enqueueError)

      await expect(policy.compute(definitionService(), coordinates)).to.be.rejectedWith(enqueueError)
    })
  })

  describe('setupProcessing()', () => {
    beforeEach(() => {
      queue.dequeueMultiple.resolves([{ data: { coordinates } }])
      queue.delete.resolves()
    })

    it('skips recompute when definition already exists', async () => {
      const getStored = sinon.stub().resolves({ coordinates, _meta: { schemaVersion: '0.0.1' } })
      const computeStoreAndCurate = sinon.stub().resolves()
      const service = { currentSchema: '1.7.0', getStored, computeStoreAndCurate } as unknown as DefinitionService

      await policy.setupProcessing(service, createMockLogger(), true)

      expect(getStored.calledOnce).to.be.true
      expect(computeStoreAndCurate.notCalled).to.be.true
      expect(queue.delete.calledOnce).to.be.true
    })

    it('recomputes when definition is missing', async () => {
      const getStored = sinon.stub().resolves(undefined)
      const computeStoreAndCurate = sinon.stub().resolves()
      const service = { currentSchema: '1.7.0', getStored, computeStoreAndCurate } as unknown as DefinitionService

      await policy.setupProcessing(service, createMockLogger(), true)

      expect(getStored.calledOnce).to.be.true
      expect(computeStoreAndCurate.calledOnce).to.be.true
      expect(queue.delete.calledOnce).to.be.true
    })
  })
})

const createQueue = (): { [K in keyof IQueue]: sinon.SinonStub } => ({
  queue: sinon.stub().resolves(),
  initialize: sinon.stub().resolves(),
  dequeue: sinon.stub().resolves(null),
  dequeueMultiple: sinon.stub().resolves([]),
  delete: sinon.stub().resolves()
})

const definitionService = (): RecomputeContext =>
  ({
    currentSchema: '1.7.0',
    buildEmptyDefinition: (coordinates: unknown) => ({
      coordinates,
      described: { tools: [] as string[] },
      _meta: { schemaVersion: '1.7.0', updated: new Date().toISOString() }
    }),
    computeStoreAndCurate: sinon.stub().resolves()
  }) as unknown as RecomputeContext

function validateEmptyDefinition(result: Definition, coordinates: EntityCoordinates) {
  expect(result.coordinates).to.deep.equal(coordinates)
  expect(result.described.tools).to.deep.equal([])
  expect(result._meta.schemaVersion).to.equal('1.7.0')
  expect(result._meta.updated).to.be.a('string')
}

function validateQueuedCoordinates(queue: { [K in keyof IQueue]: sinon.SinonStub }, coordinates: EntityCoordinates) {
  expect(queue.queue.calledOnce).to.be.true
  const queued = JSON.parse(Buffer.from(queue.queue.getCall(0).args[0], 'base64').toString())
  expect(EntityCoordinates.fromObject(queued.coordinates).toString()).to.equal(coordinates.toString())
  expect(queued._meta).to.be.undefined
}
