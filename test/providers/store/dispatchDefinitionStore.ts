import assert from 'node:assert/strict'
import { describe, it, beforeEach, mock } from 'node:test'
// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import DispatchDefinitionStore from '../../../providers/stores/dispatchDefinitionStore.js'

describe('Dispatch Definition store', () => {
  let dispatchDefinitionStore
  let store1
  let store2
  let logger

  beforeEach(() => {
    store1 = createStore()
    store2 = createStore()
    logger = { error: mock.fn() }
    dispatchDefinitionStore = DispatchDefinitionStore({
      stores: [store1, store2],
      logger
    })
  })

  it('should perform in sequence for get', async () => {
    store1.get.resolves(1)
    store2.get.resolves(2)
    const result = await dispatchDefinitionStore.get('test')
    assert.strictEqual(result, 1)
    assert.strictEqual(store1.get.mock.callCount(), 1)
    assert.strictEqual(store2.get.mock.callCount(), 0)
  })

  it('should initialize in parallel', async () => {
    store1.initialize.resolves()
    store2.initialize.resolves()
    await dispatchDefinitionStore.initialize()
    assert.strictEqual(store1.initialize.mock.callCount(), 1)
    assert.strictEqual(store2.initialize.mock.callCount(), 1)
  })

  it('should perform in parallel and handle exception', async () => {
    store1.initialize.resolves()
    store2.initialize.rejects('store2 failed')
    await dispatchDefinitionStore.initialize()
    assert.strictEqual(store1.initialize.mock.callCount(), 1)
    assert.strictEqual(store2.initialize.mock.callCount(), 1)
    assert.strictEqual(logger.error.mock.callCount(), 1)
  })
})

function createStore() {
  return {
    get: mock.fn(),
    initialize: mock.fn()
  }
}
