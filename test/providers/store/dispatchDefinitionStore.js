// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const sinon = require('sinon')
const { expect } = require('chai')
const DispatchDefinitionStore = require('../../../providers/stores/dispatchDefinitionStore')

describe('Dispatch Definition store', () => {
  let dispatchDefinitionStore, store1, store2, logger

  beforeEach(() => {
    store1 = createStore()
    store2 = createStore()
    logger = { error: sinon.stub() }
    dispatchDefinitionStore = DispatchDefinitionStore({      
      stores: [store1, store2],
      logger
    })
  })

  it('should perform in sequence for get', async () => {
    store1.get.resolves(1)
    store2.get.resolves(2)
    const result = await dispatchDefinitionStore.get('test')
    expect(result).to.be.equal(1)
    expect(store1.get.callCount).to.be.equal(1)
    expect(store2.get.callCount).to.be.equal(0)
  })

  it('should initialize in parallel', async () => {
    store1.initialize.resolves()
    store2.initialize.resolves()
    await dispatchDefinitionStore.initialize()
    expect(store1.initialize.callCount).to.be.equal(1)
    expect(store2.initialize.callCount).to.be.equal(1)
  })

  it('should perform in parallel and handle exception', async () => {
    store1.initialize.resolves()
    store2.initialize.rejects('store2 failed')
    await dispatchDefinitionStore.initialize()
    expect(store1.initialize.callCount).to.be.equal(1)
    expect(store2.initialize.callCount).to.be.equal(1)
    expect(logger.error.callCount).to.be.equal(1)
  })
})

function createStore() {
  return {
    get: sinon.stub(),
    initialize: sinon.stub()
  }
}
