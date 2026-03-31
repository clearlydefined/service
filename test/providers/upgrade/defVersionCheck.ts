// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

import { expect } from 'chai'
import sinon from 'sinon'
import { DefinitionVersionChecker, factory } from '../../../providers/upgrade/defVersionCheck.js'

describe('DefinitionVersionChecker', () => {
  let logger
  let checker
  beforeEach(() => {
    logger = { debug: sinon.stub() }
    checker = new DefinitionVersionChecker({ logger })
  })

  it('returns an instance of DefinitionVersionChecker', () => {
    expect(checker).to.be.an.instanceOf(DefinitionVersionChecker)
  })

  it('creates a new instance of DefinitionVersionChecker using factory', () => {
    const checker = factory({ logger: logger })
    expect(checker).to.be.an.instanceOf(DefinitionVersionChecker)
  })

  it('sets and gets current schema version', () => {
    checker.currentSchema = '1.0.0'
    expect(checker.currentSchema).to.equal('1.0.0')
  })

  it('initializes and returns undefined', async () => {
    const result = await checker.initialize()
    expect(result).to.be.not.ok
  })

  it('returns after setupProcessing', async () => {
    const result = checker.setupProcessing()
    expect(result).to.be.not.ok
  })

  it('throws an error in validate if current schema version is not set', async () => {
    const definition = { _meta: { schemaVersion: '1.0.0' } }
    await expect(checker.validate(definition)).to.be.rejectedWith(Error)
  })

  context('validate after current schema version is set', () => {
    beforeEach(() => {
      checker.currentSchema = '1.0.0'
    })

    it('returns the definition if it is up-to-date', async () => {
      const definition = { _meta: { schemaVersion: '1.0.0' } }
      const result = await checker.validate(definition)
      expect(result).to.deep.equal(definition)
    })

    it('returns undefined for a stale definition', async () => {
      const definition = { _meta: { schemaVersion: '0.1.0' } }
      const result = await checker.validate(definition)
      expect(result).to.be.undefined
    })

    it('returns undefined for a definition without schema version', async () => {
      const definition = {}
      const result = await checker.validate(definition)
      expect(result).to.be.undefined
    })

    it('handles null', async () => {
      checker.currentSchema = '1.0.0'
      const result = await checker.validate(null)
      expect(result).to.be.not.ok
    })
  })
})
