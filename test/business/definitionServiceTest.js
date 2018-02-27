// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const { expect } = require('chai');
const sinon = require('sinon');
const DefinitionService = require('../../business/definitionService');
const EntityCoordinates = require('../../lib/entityCoordinates');

describe('Definition Service', () => {
  it('invalidates single coordinate', () => {
    const store = { delete: sinon.stub() };
    const service = DefinitionService(null, null, null, null, store);
    const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/2.3');
    service.invalidate(coordinates);
    expect(store.delete.calledOnce).to.be.true;
    expect(store.delete.getCall(0).args[0].name).to.be.eq('test');
    expect(store.delete.getCall(0).args[0].tool).to.be.eq('definition');
  });

  it('invalidates array of coordinates', () => {
    const store = { delete: sinon.stub() };
    const service = DefinitionService(null, null, null, null, store);
    const coordinates = [
      EntityCoordinates.fromString('npm/npmjs/-/test0/2.3'),
      EntityCoordinates.fromString('npm/npmjs/-/test1/2.3')
    ];
    service.invalidate(coordinates);
    expect(store.delete.calledTwice).to.be.true;
    expect(store.delete.getCall(0).args[0].name).to.be.eq('test0');
    expect(store.delete.getCall(1).args[0].name).to.be.eq('test1');
  });
});
