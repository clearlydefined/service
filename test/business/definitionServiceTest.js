// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const DefinitionService = require('../../business/definitionService')
const EntityCoordinates = require('../../lib/entityCoordinates')

describe('Definition Service', () => {
  it('invalidates single coordinate', async () => {
    const store = { delete: sinon.stub() }
    const search = { delete: sinon.stub() }
    const service = DefinitionService(null, null, null, null, store, search)
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/2.3')
    await service.invalidate(coordinates)
    expect(store.delete.calledOnce).to.be.true
    expect(store.delete.getCall(0).args[0].name).to.be.eq('test')
    expect(store.delete.getCall(0).args[0].tool).to.be.eq('definition')
    expect(search.delete.calledOnce).to.be.true
    expect(search.delete.getCall(0).args[0].name).to.be.eq('test')
    expect(search.delete.getCall(0).args[0].tool).to.be.eq('definition')
  })

  it('invalidates array of coordinates', async () => {
    const store = { delete: sinon.stub() }
    const search = { delete: sinon.stub() }
    const service = DefinitionService(null, null, null, null, store, search)
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3')
    ]
    await service.invalidate(coordinates)
    expect(store.delete.calledTwice).to.be.true
    expect(store.delete.getCall(0).args[0].name).to.be.eq('test0')
    expect(store.delete.getCall(1).args[0].name).to.be.eq('test1')
    expect(search.delete.calledTwice).to.be.true
    expect(search.delete.getCall(0).args[0].name).to.be.eq('test0')
    expect(search.delete.getCall(1).args[0].name).to.be.eq('test1')
  })
})
