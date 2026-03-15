// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')

const EntityCoordinates = require('../../../lib/entityCoordinates')
const { delayedFactory } = require('../../../providers/upgrade/recomputeHandler')
const { createOnDemandComputePolicy } = require('../../../providers/upgrade/onDemandComputePolicy')
const { QueueComputePolicy, createDelayedComputePolicy } = require('../../../providers/upgrade/queueComputePolicy')

describe('RecomputeHandler compute policies', () => {
  it('on-demand compute policy delegates to computeStoreAndCurate', async () => {
    const policy = createOnDemandComputePolicy()
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/leftpad/1.0.0')
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

  it('delayed compute policy factory creates QueueComputePolicy', async () => {
    const queue = {
      queue: sinon.stub().resolves(),
      initialize: sinon.stub().resolves()
    }
    const policy = createDelayedComputePolicy({
      logger: { info: sinon.stub(), error: sinon.stub() },
      queue: () => queue
    })

    expect(policy).to.be.instanceOf(QueueComputePolicy)
  })

  it('QueueComputePolicy queues and returns a valid placeholder definition', async () => {
    const queue = {
      queue: sinon.stub().resolves(),
      initialize: sinon.stub().resolves()
    }
    const policy = new QueueComputePolicy({
      logger: { info: sinon.stub(), error: sinon.stub() },
      queue: () => queue
    })
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/leftpad/1.0.0')
    const definitionService = { currentSchema: '1.7.0' }

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

  it('delayedFactory wires delayed compute policy to queue upgrader', async () => {
    const queue = {
      queue: sinon.stub().resolves(),
      initialize: sinon.stub().resolves()
    }
    const handler = delayedFactory({ logger: { info: sinon.stub(), error: sinon.stub() }, queue: () => queue })
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/leftpad/1.0.0')
    const definitionService = { currentSchema: '1.7.0' }

    await handler.initialize()
    const result = await handler.compute(definitionService, coordinates)

    expect(queue.queue.calledOnce).to.be.true
    expect(result.coordinates).to.deep.equal(coordinates)
    expect(result.described.tools).to.deep.equal([])
    expect(result._meta.schemaVersion).to.equal('1.7.0')
  })
})
