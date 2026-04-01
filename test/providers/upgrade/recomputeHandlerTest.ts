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
import DefinitionQueueUpgrader from '../../../providers/upgrade/defUpgradeQueue.js'
import { DefinitionVersionChecker } from '../../../providers/upgrade/defVersionCheck.js'
import { DelayedComputePolicy } from '../../../providers/upgrade/delayedComputePolicy.js'
import memoryQueueConfig from '../../../providers/upgrade/memoryQueueConfig.js'
import { OnDemandComputePolicy } from '../../../providers/upgrade/onDemandComputePolicy.js'
import { defaultFactory, delayedFactory, RecomputeHandler } from '../../../providers/upgrade/recomputeHandler.js'
import loggerSingleton from '../../../providers/logging/logger.js'
import { createMockLogger, type StubbedLogger } from '../../helpers/mockLogger.ts'

// MemoryQueue uses the global logger singleton — prime it so tests can run in isolation
before(() => loggerSingleton(createMockLogger()))

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
      expect(upgradePolicy.setupProcessing.firstCall.args.slice(0, 3)).to.deep.equal([definitionService, logger, true])
      expect(computePolicy.setupProcessing.firstCall.args.slice(0, 3)).to.deep.equal([definitionService, logger, true])
    })

    it('passes the same shared cache to both policies', async () => {
      const definitionService = { currentSchema: '1.7.0' } as unknown as DefinitionService

      await handler.setupProcessing(definitionService, logger, false)

      const upgradeCache = upgradePolicy.setupProcessing.firstCall.args[3]
      const computeCache = computePolicy.setupProcessing.firstCall.args[3]
      expect(upgradeCache).to.exist
      expect(upgradeCache).to.equal(computeCache)
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

describe('shared cache', () => {
  it('deduplicates compute across upgrade and compute queues for same coordinates', async () => {
    const upgradeQueue = memoryQueueConfig.upgrade()
    const computeQueue = memoryQueueConfig.compute()
    const coordinates = EntityCoordinates.fromString(TEST_COORDINATES)
    const logger = createMockLogger()
    const handler = delayedFactory({
      logger,
      queue: { upgrade: () => upgradeQueue, compute: () => computeQueue }
    })

    const storedDef = { coordinates, _meta: { schemaVersion: '1.7.0' } }
    const getStored = sinon.stub().resolves(undefined)
    const computeStoreAndCurate = sinon.stub().callsFake(async () => {
      getStored.resolves(storedDef)
    })
    const definitionService = {
      currentSchema: '1.7.0',
      getStored,
      computeStoreAndCurate
    } as unknown as DefinitionService

    await handler.initialize()
    await upgradeQueue.queue(
      Buffer.from(JSON.stringify({ coordinates, _meta: { schemaVersion: '0.0.1' } })).toString('base64')
    )
    await computeQueue.queue(Buffer.from(JSON.stringify({ coordinates })).toString('base64'))
    await handler.setupProcessing(definitionService, logger, true)

    expect(computeStoreAndCurate.calledOnce).to.be.true
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
