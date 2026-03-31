// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import { expect } from 'chai'
import sinon from 'sinon'
import type { DefinitionService, RecomputeContext } from '../../../business/definitionService.js'
import EntityCoordinates from '../../../lib/entityCoordinates.js'
import type { IQueue } from '../../../providers/queueing/index.js'
import { DelayedComputePolicy } from '../../../providers/upgrade/delayedComputePolicy.js'
import { OnDemandComputePolicy } from '../../../providers/upgrade/onDemandComputePolicy.js'
import { delayedFactory, RecomputeHandler } from '../../../providers/upgrade/recomputeHandler.js'
import { createMockLogger, type StubbedLogger } from '../../helpers/mockLogger.ts'

describe('RecomputeHandler', () => {
  let upgradePolicy: ReturnType<typeof createUpgradePolicy>
  let computePolicy: ReturnType<typeof createComputePolicy>
  let logger: StubbedLogger
  let handler: InstanceType<typeof RecomputeHandler>

  beforeEach(() => {
    upgradePolicy = createUpgradePolicy()
    computePolicy = createComputePolicy()
    logger = createMockLogger()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler = new RecomputeHandler({ upgradePolicy: upgradePolicy as any, computePolicy: computePolicy as any, logger })
  })

  it('initializes both upgrade and compute policies', async () => {
    await handler.initialize()

    expect(upgradePolicy.initialize.calledOnce).to.be.true
    expect(computePolicy.initialize.calledOnce).to.be.true
  })

  it('supports policy initialize hooks being undefined', async () => {
    upgradePolicy = createUpgradePolicy({ initialize: undefined })
    computePolicy = createComputePolicy({ initialize: undefined })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler = new RecomputeHandler({ upgradePolicy: upgradePolicy as any, computePolicy: computePolicy as any, logger })

    await handler.initialize()
  })

  it('delegates setupProcessing to both policies', async () => {
    const definitionService = { currentSchema: '1.7.0' } as unknown as DefinitionService

    await handler.setupProcessing(definitionService, logger, true)

    expect(upgradePolicy.setupProcessing.calledOnce).to.be.true
    expect(computePolicy.setupProcessing.calledOnce).to.be.true
    expect(upgradePolicy.setupProcessing.firstCall.args.slice(0, 3)).to.deep.equal([definitionService, logger, true])
    expect(computePolicy.setupProcessing.firstCall.args.slice(0, 3)).to.deep.equal([definitionService, logger, true])

    const upgradeCache = upgradePolicy.setupProcessing.firstCall.args[3]
    const computeCache = computePolicy.setupProcessing.firstCall.args[3]
    expect(upgradeCache).to.exist
    expect(computeCache).to.exist
  })

  it('passes the same shared cache instance to both policies', async () => {
    const definitionService = { currentSchema: '1.7.0' } as unknown as DefinitionService

    await handler.setupProcessing(definitionService, logger, false)

    const upgradeCache = upgradePolicy.setupProcessing.firstCall.args[3]
    const computeCache = computePolicy.setupProcessing.firstCall.args[3]

    expect(upgradeCache).to.exist
    expect(computeCache).to.exist
    expect(upgradeCache).to.equal(computeCache)
  })

  it('delegates validate to upgrade policy', async () => {
    const definition = { _meta: { schemaVersion: '1.7.0' } }
    upgradePolicy.validate.resolves(definition)

    const result = await handler.validate(null)

    expect(upgradePolicy.validate.calledOnceWithExactly(null)).to.be.true
    expect(result).to.equal(definition)
  })

  it('delegates compute to compute policy', async () => {
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    const definitionService = {
      currentSchema: '1.7.0',
      buildEmptyDefinition: sinon.stub()
    } as unknown as RecomputeContext
    const expectedDefinition = {
      coordinates,
      _meta: { schemaVersion: '1.7.0' }
    }
    computePolicy.compute.resolves(expectedDefinition)

    const result = await handler.compute(definitionService, coordinates)

    expect(computePolicy.compute.calledOnceWithExactly(definitionService, coordinates)).to.be.true
    expect(result).to.equal(expectedDefinition)
  })

  it('sets and gets schema version through upgrade policy', () => {
    handler.currentSchema = '1.7.0'

    expect(upgradePolicy.currentSchema).to.equal('1.7.0')
    expect(handler.currentSchema).to.equal('1.7.0')
  })
})

describe('RecomputeHandler compute policies', () => {
  describe('on-demand', () => {
    it('delegates to computeStoreAndCurate', async () => {
      const policy = new OnDemandComputePolicy()
      const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
      const definition = {
        coordinates,
        described: { tools: ['component'] },
        _meta: { schemaVersion: '1.7.0', updated: new Date().toISOString() }
      }
      const definitionService = {
        computeStoreAndCurate: sinon.stub().resolves(definition)
      } as unknown as RecomputeContext

      const result = await policy.compute(definitionService, coordinates)

      expect(
        (
          definitionService as unknown as { computeStoreAndCurate: sinon.SinonStub }
        ).computeStoreAndCurate.calledOnceWithExactly(coordinates)
      ).to.be.true
      expect(result).to.deep.equal(definition)
    })
  })

  describe('DelayedComputePolicy', () => {
    let queue: ReturnType<typeof createQueue>
    let queueLogger: StubbedLogger
    let policy: InstanceType<typeof DelayedComputePolicy>
    let coordinates: ReturnType<typeof EntityCoordinates.fromString>

    beforeEach(() => {
      queue = createQueue()
      queueLogger = createMockLogger()
      policy = new DelayedComputePolicy({
        logger: queueLogger,
        queue: () => queue as unknown as IQueue
      })
      coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    })

    it('delayed compute policy factory creates DelayedComputePolicy', async () => {
      expect(policy).to.be.instanceOf(DelayedComputePolicy)
    })

    it('queues and returns a valid placeholder definition', async () => {
      const definitionService = createPlaceholderDefinitionService()

      await policy.initialize()
      const result = await policy.compute(definitionService, coordinates)
      const queuedMessage = queue.queue.getCall(0).args[0]
      const queuedData = JSON.parse(Buffer.from(queuedMessage, 'base64').toString())

      expect(queue.queue.calledOnce).to.be.true
      expect(EntityCoordinates.fromObject(queuedData.coordinates).toString()).to.equal(coordinates.toString())
      expect(queuedData._meta).to.be.undefined
      expect(result.coordinates).to.deep.equal(coordinates)
      expect(result.described.tools).to.deep.equal([])
      expect(result._meta.schemaVersion).to.equal('1.7.0')
      expect(result._meta.updated).to.be.a('string')
    })

    it('throws when delayed queue enqueue fails', async () => {
      const definitionService = createPlaceholderDefinitionService()
      const enqueueError = new Error('compute queue unavailable')
      queue.queue.rejects(enqueueError)

      await policy.initialize()
      await expect(policy.compute(definitionService, coordinates)).to.be.rejectedWith(enqueueError)
    })

    it('setupProcessing skips recompute when definition already exists', async () => {
      setupQueueProcessingMocks(queue, coordinates)
      const existingDefinition = { coordinates, _meta: { schemaVersion: '0.0.1' } }
      const getStored = sinon.stub().resolves(existingDefinition)
      const computeStoreAndCurate = sinon.stub().resolves()
      const definitionService = {
        currentSchema: '1.7.0',
        getStored,
        computeStoreAndCurate
      } as unknown as DefinitionService

      await policy.initialize()
      await policy.setupProcessing(definitionService, queueLogger, true)

      expect(getStored.calledOnce).to.be.true
      expect(computeStoreAndCurate.notCalled).to.be.true
      expect((queue as unknown as { delete: sinon.SinonStub }).delete.calledOnce).to.be.true
    })

    it('setupProcessing recomputes when definition is missing', async () => {
      setupQueueProcessingMocks(queue, coordinates)
      const getStored = sinon.stub().resolves(undefined)
      const computeStoreAndCurate = sinon.stub().resolves()
      const definitionService = {
        currentSchema: '1.7.0',
        getStored,
        computeStoreAndCurate
      } as unknown as DefinitionService

      await policy.initialize()
      await policy.setupProcessing(definitionService, queueLogger, true)

      expect(getStored.calledOnce).to.be.true
      expect(computeStoreAndCurate.calledOnce).to.be.true
      expect((queue as unknown as { delete: sinon.SinonStub }).delete.calledOnce).to.be.true
    })
  })

  it('delayedFactory wires delayed compute policy to queue upgrader', async () => {
    const upgradeQueue = createQueue({
      dequeueMultiple: sinon.stub().resolves([]),
      delete: sinon.stub().resolves()
    })
    const computeQueue = createQueue()
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    const handler = delayedFactory({
      logger: createMockLogger(),
      queue: { upgrade: () => upgradeQueue as unknown as IQueue, compute: () => computeQueue as unknown as IQueue }
    })
    const definitionService = createPlaceholderDefinitionService()

    await handler.initialize()
    const result = await handler.compute(definitionService, coordinates)

    expect(upgradeQueue.initialize.calledOnce).to.be.true
    expect(computeQueue.initialize.calledOnce).to.be.true
    expect(computeQueue.queue.calledOnce).to.be.true
    expect(result.coordinates).to.deep.equal(coordinates)
    expect(result.described.tools).to.deep.equal([])
    expect(result._meta.schemaVersion).to.equal('1.7.0')
  })
})

const TEST_COORDINATES = 'npm/npmjs/-/leftpad/1.0.0'

const createUpgradePolicy = (overrides: Record<string, unknown> = {}) => ({
  initialize: sinon.stub().resolves(),
  validate: sinon.stub().resolves(),
  setupProcessing: sinon.stub().resolves(),
  currentSchema: undefined as string | undefined,
  ...overrides
})

const createComputePolicy = (overrides: Record<string, unknown> = {}) => ({
  initialize: sinon.stub().resolves(),
  setupProcessing: sinon.stub().resolves(),
  compute: sinon.stub().resolves(undefined),
  ...overrides
})

const createQueue = (overrides: Record<string, unknown> = {}) => ({
  queue: sinon.stub().resolves(),
  initialize: sinon.stub().resolves(),
  ...overrides
})

const createPlaceholderDefinitionService = () =>
  ({
    currentSchema: '1.7.0',
    buildEmptyDefinition: (coordinates: unknown) => ({
      coordinates,
      described: { tools: [] as string[] },
      _meta: { schemaVersion: '1.7.0', updated: new Date().toISOString() }
    }),
    computeStoreAndCurate: sinon.stub().resolves()
  }) as unknown as RecomputeContext

const setupQueueProcessingMocks = (queue: ReturnType<typeof createQueue>, coordinates: unknown) => {
  ;(queue as Record<string, unknown>).dequeueMultiple = sinon.stub().resolves([{ data: { coordinates } }])
  ;(queue as Record<string, unknown>).delete = sinon.stub().resolves()
}
