// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import { expect } from 'chai'
import sinon from 'sinon'
import type { Definition, DefinitionService, RecomputeContext } from '../../../business/definitionService.js'
import EntityCoordinates from '../../../lib/entityCoordinates.ts'
import type { ICache } from '../../../providers/caching/index.js'
import type { IQueue } from '../../../providers/queueing/index.js'
import { DelayedComputePolicy } from '../../../providers/upgrade/delayedComputePolicy.ts'
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

    describe('with enqueueCache', () => {
      let enqueueCache: { [K in keyof ICache]: sinon.SinonStub }
      let dedupPolicy: DelayedComputePolicy

      beforeEach(async () => {
        enqueueCache = createEnqueueCache()
        dedupPolicy = new DelayedComputePolicy({ logger: createMockLogger(), queue: () => queue, enqueueCache })
        await dedupPolicy.initialize()
      })

      it('skips enqueue for duplicate coordinates within cache TTL', async () => {
        await dedupPolicy.compute(definitionService(), coordinates)
        await dedupPolicy.compute(definitionService(), coordinates)

        expect(queue.queue.calledOnce).to.be.true
      })

      it('enqueues again after cache entry expires', async () => {
        await dedupPolicy.compute(definitionService(), coordinates)
        enqueueCache.delete.callsFake((key: string) => enqueueCache.get.withArgs(key).returns(null))
        enqueueCache.get.returns(null)

        await dedupPolicy.compute(definitionService(), coordinates)

        expect(queue.queue.calledTwice).to.be.true
      })

      it('enqueues independently for different coordinates', async () => {
        const other = EntityCoordinates.fromString('npm/npmjs/-/debug/4.3.4')

        await dedupPolicy.compute(definitionService(), coordinates)
        await dedupPolicy.compute(definitionService(), other)

        expect(queue.queue.calledTwice).to.be.true
      })
    })
  })

  describe('setupProcessing()', () => {
    let getStored: sinon.SinonStub
    let computeStoreAndCurateIf: sinon.SinonStub
    let service: DefinitionService
    let shouldComputeResult: boolean | undefined

    beforeEach(() => {
      const definition = { coordinates, _meta: { schemaVersion: '1.7.0' } }
      queue.dequeueMultiple.resolves([{ data: { coordinates } }])
      queue.delete.resolves()
      getStored = sinon.stub()
      shouldComputeResult = undefined
      computeStoreAndCurateIf = sinon.stub().callsFake(async (_coords, shouldCompute) => {
        shouldComputeResult = await shouldCompute()
        return shouldComputeResult ? definition : undefined
      })
      service = { currentSchema: '1.7.0', getStored, computeStoreAndCurateIf } as unknown as DefinitionService
    })

    it('skips recompute when definition already exists', async () => {
      getStored.resolves({ coordinates, _meta: { schemaVersion: '1.7.0' } })

      await policy.setupProcessing(service, createMockLogger(), true)

      expect(getStored.calledOnce).to.be.true
      expect(computeStoreAndCurateIf.calledOnce).to.be.true
      expect(shouldComputeResult).to.be.false
      expect(await computeStoreAndCurateIf.returnValues[0]).to.be.undefined
      expect(queue.delete.calledOnce).to.be.true
    })

    it('recomputes when definition is missing', async () => {
      getStored.resolves(undefined)

      await policy.setupProcessing(service, createMockLogger(), true)

      expect(getStored.calledOnce).to.be.true
      expect(computeStoreAndCurateIf.calledOnce).to.be.true
      expect(shouldComputeResult).to.be.true
      expect(await computeStoreAndCurateIf.returnValues[0]).to.exist
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

const createEnqueueCache = (): { [K in keyof ICache]: sinon.SinonStub } => {
  const store = new Map<string, unknown>()
  return {
    initialize: sinon.stub().resolves(),
    get: sinon.stub().callsFake((key: string) => store.get(key) ?? null),
    set: sinon.stub().callsFake((key: string, value: unknown) => store.set(key, value)),
    delete: sinon.stub().callsFake((key: string) => store.delete(key)),
    done: sinon.stub().resolves()
  }
}
