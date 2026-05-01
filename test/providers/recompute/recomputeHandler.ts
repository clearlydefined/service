// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import { expect } from 'chai'
import sinon from 'sinon'
import type { Definition, DefinitionService, RecomputeContext } from '../../../business/definitionService.ts'
import DefinitionServiceFactory from '../../../business/definitionService.ts'
import EntityCoordinates from '../../../lib/entityCoordinates.ts'
import type { IQueue } from '../../../providers/queueing/index.js'
import DefinitionQueueUpgrader from '../../../providers/recompute/defUpgradeQueue.ts'
import { DefinitionVersionChecker } from '../../../providers/recompute/defVersionCheck.ts'
import { DelayedComputePolicy } from '../../../providers/recompute/delayedComputePolicy.ts'
import memoryQueueConfig from '../../../providers/recompute/memoryQueueConfig.ts'
import { OnDemandComputePolicy } from '../../../providers/recompute/onDemandComputePolicy.ts'
import { defaultFactory, delayedFactory, RecomputeHandler } from '../../../providers/recompute/recomputeHandler.ts'
import { createMockLogger, createSilentLogger, type StubbedLogger } from '../../helpers/mockLogger.ts'

const TEST_COORDINATES = 'npm/npmjs/-/leftpad/1.0.0'

describe('RecomputeHandler', () => {
  let upgradePolicy: ReturnType<typeof createUpgradePolicy>
  let computePolicy: ReturnType<typeof createComputePolicy>
  let logger: StubbedLogger
  let handler: RecomputeHandler

  beforeEach(() => {
    upgradePolicy = createUpgradePolicy()
    computePolicy = createComputePolicy()
    logger = createMockLogger()
    handler = new RecomputeHandler({ upgradePolicy: upgradePolicy as any, computePolicy: computePolicy as any, logger })
  })

  describe('initialize()', () => {
    it('calls initialize on both policies', async () => {
      await handler.initialize()

      expect(upgradePolicy.initialize.calledOnce).to.be.true
      expect(computePolicy.initialize.calledOnce).to.be.true
    })

    it('succeeds when initialize hooks are undefined', async () => {
      handler = new RecomputeHandler({
        upgradePolicy: createUpgradePolicy({ initialize: undefined }) as any,
        computePolicy: createComputePolicy({ initialize: undefined }) as any,
        logger
      })

      await handler.initialize()
    })

    it('propagates upgrade policy error', async () => {
      const error = new Error('upgrade init failed')
      handler = new RecomputeHandler({
        upgradePolicy: createUpgradePolicy({ initialize: sinon.stub().rejects(error) }) as any,
        computePolicy: computePolicy as any,
        logger
      })

      await expect(handler.initialize()).to.be.rejectedWith(error)
    })

    it('propagates compute policy error', async () => {
      const error = new Error('compute init failed')
      handler = new RecomputeHandler({
        upgradePolicy: upgradePolicy as any,
        computePolicy: createComputePolicy({ initialize: sinon.stub().rejects(error) }) as any,
        logger
      })

      await expect(handler.initialize()).to.be.rejectedWith(error)
    })
  })

  describe('setupProcessing()', () => {
    it('delegates to both policies with shared arguments', async () => {
      const definitionService = { currentSchema: '1.7.0' } as unknown as DefinitionService

      await handler.setupProcessing(definitionService, logger, true)

      expect(upgradePolicy.setupProcessing.calledOnce).to.be.true
      expect(computePolicy.setupProcessing.calledOnce).to.be.true
      expect(upgradePolicy.setupProcessing.firstCall.args).to.deep.equal([definitionService, logger, true])
      expect(computePolicy.setupProcessing.firstCall.args).to.deep.equal([definitionService, logger, true])
    })
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
    const expectedDefinition = { coordinates, _meta: { schemaVersion: '1.7.0' } }
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

describe('defaultFactory', () => {
  let handler: RecomputeHandler

  beforeEach(() => {
    handler = defaultFactory({ logger: createMockLogger() })
  })

  it('uses DefinitionVersionChecker as upgrade policy', () => {
    expect(privateField(handler, '_upgradePolicy')).to.be.instanceOf(DefinitionVersionChecker)
  })

  it('uses OnDemandComputePolicy as compute policy', () => {
    expect(privateField(handler, '_computePolicy')).to.be.instanceOf(OnDemandComputePolicy)
  })

  it('ignores queue option — computes on-demand via computeStoreAndCurate', async () => {
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    const computeStoreAndCurate = sinon.stub().resolves({ coordinates })
    const definitionService = { computeStoreAndCurate } as unknown as RecomputeContext

    await handler.initialize()
    await handler.compute(definitionService, coordinates)

    expect(computeStoreAndCurate.calledOnceWithExactly(coordinates)).to.be.true
  })
})

describe('delayedFactory', () => {
  let handler: RecomputeHandler

  beforeEach(() => {
    handler = delayedFactory({
      logger: createMockLogger(),
      queue: { upgrade: () => createQueue(), compute: () => createQueue() }
    })
  })

  it('uses DefinitionQueueUpgrader as upgrade policy', () => {
    expect(privateField(handler, '_upgradePolicy')).to.be.instanceOf(DefinitionQueueUpgrader)
  })

  it('uses DelayedComputePolicy as compute policy', () => {
    expect(privateField(handler, '_computePolicy')).to.be.instanceOf(DelayedComputePolicy)
  })

  it('wires custom queue factories to correct policies', async () => {
    const upgradeQueue = createQueue()
    const computeQueue = createQueue()
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    handler = delayedFactory({
      logger: createMockLogger(),
      queue: { upgrade: () => upgradeQueue, compute: () => computeQueue }
    })

    await handler.initialize()
    const result = await handler.compute(createDefinitionService(), coordinates)

    expect(upgradeQueue.initialize.calledOnce).to.be.true
    expect(computeQueue.initialize.calledOnce).to.be.true
    expect(computeQueue.queue.calledOnce).to.be.true
    expect(upgradeQueue.queue.notCalled).to.be.true
    expect(result.coordinates).to.deep.equal(coordinates)
    expect(result._meta.schemaVersion).to.equal('1.7.0')
  })

  it('falls back to memoryQueueConfig when no queue option provided', async () => {
    handler = delayedFactory({ logger: createMockLogger() })
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)

    await handler.initialize()
    const result = await handler.compute(createDefinitionService(), coordinates)

    expect(result.coordinates).to.deep.equal(coordinates)
    expect(result._meta.schemaVersion).to.equal('1.7.0')
  })
})

describe('upgrade and compute queue wiring', () => {
  it('both queues delegate to computeStoreAndCurateIf with the correct coordinates', async () => {
    const upgradeQueue = memoryQueueConfig.upgrade()
    const computeQueue = memoryQueueConfig.compute()
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    const logger = createMockLogger()
    const handler = delayedFactory({
      logger,
      queue: { upgrade: () => upgradeQueue, compute: () => computeQueue }
    })

    const computeStoreAndCurateIf = sinon.stub().resolves(undefined)
    const definitionService = {
      currentSchema: '1.7.0',
      computeStoreAndCurateIf
    } as unknown as DefinitionService

    await handler.initialize()
    await upgradeQueue.queue(buildMessage({ coordinates, _meta: { schemaVersion: '0.0.1' } }))
    await computeQueue.queue(buildMessage({ coordinates }))
    await handler.setupProcessing(definitionService, logger, true)

    // Each queue message results in exactly one computeStoreAndCurateIf call with the right coordinates
    expect(computeStoreAndCurateIf.calledTwice).to.be.true
    expect(computeStoreAndCurateIf.getCall(0).args[0]).to.deep.equal(coordinates)
    expect(computeStoreAndCurateIf.getCall(1).args[0]).to.deep.equal(coordinates)
  })

  it('computes only once when both queues race for the same coordinates', async () => {
    const upgradeQueue = memoryQueueConfig.upgrade()
    const computeQueue = memoryQueueConfig.compute()
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    const logger = createMockLogger()
    const handler = delayedFactory({
      logger,
      queue: { upgrade: () => upgradeQueue, compute: () => computeQueue }
    })

    // Real service so computeStoreAndCurateIf's lock actually serializes the two concurrent calls
    const service = createRealDefinitionService(coordinates)

    await handler.initialize()
    await upgradeQueue.queue(buildMessage({ coordinates, _meta: { schemaVersion: '0.0.1' } }))
    await computeQueue.queue(buildMessage({ coordinates }))
    await handler.setupProcessing(service, logger, true)

    // The lock serializes the two calls: the first computes, the second re-checks getStored and skips
    expect(service.compute.calledOnce).to.be.true
  })
})

const privateField = (obj: unknown, field: string): unknown => (obj as Record<string, unknown>)[field]

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

const createQueue = (): { [K in keyof IQueue]: sinon.SinonStub } => ({
  queue: sinon.stub().resolves(),
  initialize: sinon.stub().resolves(),
  dequeue: sinon.stub().resolves(null),
  dequeueMultiple: sinon.stub().resolves([]),
  delete: sinon.stub().resolves()
})

const buildMessage = (data: Record<string, unknown>): string => Buffer.from(JSON.stringify(data)).toString('base64')

const createRealDefinitionService = (
  coordinates: EntityCoordinates
): DefinitionService & { compute: sinon.SinonStub } => {
  const harvestService = { done: sinon.stub().resolves() } // called by _store
  const definitionStore = { store: sinon.stub().resolves() } // called by _store
  const cache = { set: sinon.stub().resolves(), delete: sinon.stub() } // called by _store
  const curationService = { autoCurate: sinon.stub().resolves() } // called by computeStoreAndCurateIf

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial implementations for unused dependencies
  const service = (DefinitionServiceFactory as (...args: any[]) => DefinitionService)(
    null,
    harvestService,
    null,
    null,
    curationService,
    definitionStore,
    null,
    cache,
    null
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- logger is an internal property
  ;(service as any).logger = createSilentLogger()

  // getStored starts null; compute "stores" the result so subsequent predicate evaluations skip
  let stored: Definition | null = null
  sinon.stub(service, 'getStored').callsFake(async () => stored)
  sinon.stub(service, 'compute').callsFake(async () => {
    const def = {
      coordinates,
      _meta: { schemaVersion: '1.7.0' },
      described: { tools: ['tool/1.0'] }
    } as unknown as Definition
    stored = def
    return def
  })

  return service as DefinitionService & { compute: sinon.SinonStub }
}

const createDefinitionService = (): RecomputeContext =>
  ({
    currentSchema: '1.7.0',
    buildEmptyDefinition: (coordinates: unknown) => ({
      coordinates,
      described: { tools: [] as string[] },
      _meta: { schemaVersion: '1.7.0', updated: new Date().toISOString() }
    }),
    computeStoreAndCurate: sinon.stub().resolves()
  }) as unknown as RecomputeContext
