// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')

const EntityCoordinates = require('../../../lib/entityCoordinates')
const { RecomputeHandler, delayedFactory } = require('../../../providers/upgrade/recomputeHandler')
const { OnDemandComputePolicy } = require('../../../providers/upgrade/onDemandComputePolicy')
const { DelayedComputePolicy } = require('../../../providers/upgrade/delayedComputePolicy')

describe('RecomputeHandler', () => {
  let upgradePolicy
  let computePolicy
  let logger
  let handler

  beforeEach(() => {
    upgradePolicy = createUpgradePolicy()
    computePolicy = createComputePolicy()
    logger = createLogger()
    handler = new RecomputeHandler({ upgradePolicy, computePolicy, logger })
  })

  it('initializes both upgrade and compute policies', async () => {
    await handler.initialize()

    expect(upgradePolicy.initialize.calledOnce).to.be.true
    expect(computePolicy.initialize.calledOnce).to.be.true
  })

  it('supports policy initialize hooks being undefined', async () => {
    upgradePolicy = createUpgradePolicy({ initialize: undefined })
    computePolicy = createComputePolicy({ initialize: undefined })
    handler = new RecomputeHandler({ upgradePolicy, computePolicy, logger })

    await handler.initialize()
  })

  it('delegates setupProcessing to both policies', async () => {
    const definitionService = { currentSchema: '1.7.0' }

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
    const definitionService = { currentSchema: '1.7.0' }

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
    }
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
      }

      const result = await policy.compute(definitionService, coordinates)

      expect(definitionService.computeStoreAndCurate.calledOnceWithExactly(coordinates)).to.be.true
      expect(result).to.deep.equal(definition)
    })
  })

  describe('DelayedComputePolicy', () => {
    let queue
    let queueLogger
    let policy
    let coordinates

    beforeEach(() => {
      queue = createQueue()
      queueLogger = createLogger()
      policy = new DelayedComputePolicy({
        logger: queueLogger,
        queue: () => queue
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
      expect(queuedData._meta).to.deep.equal({})
      expect(result.coordinates).to.deep.equal(coordinates)
      expect(result.described.tools).to.deep.equal([])
      expect(result._meta.schemaVersion).to.equal('1.7.0')
      expect(result._meta.updated).to.be.a('string')
    })

    it('returns placeholder when delayed queue enqueue fails', async () => {
      const definitionService = createPlaceholderDefinitionService()
      const enqueueError = new Error('compute queue unavailable')
      queue.queue.rejects(enqueueError)

      await policy.initialize()
      const result = await policy.compute(definitionService, coordinates)

      expect(result.coordinates).to.deep.equal(coordinates)
      expect(result.described.tools).to.deep.equal([])
    })

    it('setupProcessing skips recompute when definition already exists', async () => {
      setupQueueProcessingMocks(queue, coordinates)
      const existingDefinition = {
        coordinates,
        _meta: { schemaVersion: '0.0.1' }
      }
      const definitionService = {
        currentSchema: '1.7.0',
        getStored: sinon.stub().resolves(existingDefinition),
        computeStoreAndCurate: sinon.stub().resolves()
      }

      await policy.initialize()
      await policy.setupProcessing(definitionService, queueLogger, true)

      expect(definitionService.getStored.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.notCalled).to.be.true
      expect(queue.delete.calledOnce).to.be.true
    })

    it('setupProcessing recomputes when definition is missing', async () => {
      setupQueueProcessingMocks(queue, coordinates)
      const definitionService = {
        currentSchema: '1.7.0',
        getStored: sinon.stub().resolves(undefined),
        computeStoreAndCurate: sinon.stub().resolves()
      }

      await policy.initialize()
      await policy.setupProcessing(definitionService, queueLogger, true)

      expect(definitionService.getStored.calledOnce).to.be.true
      expect(definitionService.computeStoreAndCurate.calledOnce).to.be.true
      expect(queue.delete.calledOnce).to.be.true
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
      logger: createLogger(),
      queue: { upgrade: () => upgradeQueue, compute: () => computeQueue }
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

const createUpgradePolicy = (overrides = {}) => ({
  initialize: sinon.stub().resolves(),
  validate: sinon.stub().resolves(),
  setupProcessing: sinon.stub().resolves(),
  currentSchema: undefined,
  ...overrides
})

const createComputePolicy = (overrides = {}) => ({
  initialize: sinon.stub().resolves(),
  setupProcessing: sinon.stub().resolves(),
  compute: sinon.stub().resolves(undefined),
  ...overrides
})

const createLogger = () => ({
  info: sinon.stub(),
  error: sinon.stub(),
  debug: sinon.stub()
})

const createQueue = (overrides = {}) => ({
  queue: sinon.stub().resolves(),
  initialize: sinon.stub().resolves(),
  ...overrides
})

const createPlaceholderDefinitionService = () => ({
  currentSchema: '1.7.0',
  buildEmptyDefinition: coordinates => ({
    coordinates,
    described: { tools: [] },
    _meta: { schemaVersion: '1.7.0', updated: new Date().toISOString() }
  })
})

const setupQueueProcessingMocks = (queue, coordinates) => {
  queue.dequeueMultiple = sinon.stub().resolves([{ data: { coordinates } }])
  queue.delete = sinon.stub().resolves()
}
