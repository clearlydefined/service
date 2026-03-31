import assert from 'node:assert/strict'
import { describe, it, beforeEach, mock } from 'node:test'
// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT



import { DefinitionVersionChecker, factory } from '../../../providers/upgrade/defVersionCheck.js'

describe('DefinitionVersionChecker', () => {
  let logger
  let checker
  beforeEach(() => {
    logger = { debug: mock.fn() }
    checker = new DefinitionVersionChecker({ logger })
  })

  it('returns an instance of DefinitionVersionChecker', () => {
    assert.ok(checker instanceof DefinitionVersionChecker)
  })

  it('creates a new instance of DefinitionVersionChecker using factory', () => {
    const checker = factory({ logger: logger })
    assert.ok(checker instanceof DefinitionVersionChecker)
  })

  it('sets and gets current schema version', () => {
    checker.currentSchema = '1.0.0'
    assert.strictEqual(checker.currentSchema, '1.0.0')
  })

  it('initializes and returns undefined', async () => {
    const result = await checker.initialize()
    assert.ok(!result)
  })

  it('returns after setupProcessing', async () => {
    const result = checker.setupProcessing()
    assert.ok(!result)
  })

  it('throws an error in validate if current schema version is not set', async () => {
    const definition = { _meta: { schemaVersion: '1.0.0' } }
    await assert.rejects(checker.validate(definition), Error)
  })

  describe('validate after current schema version is set', () => {
    beforeEach(() => {
      checker.currentSchema = '1.0.0'
    })

    it('returns the definition if it is up-to-date', async () => {
      const definition = { _meta: { schemaVersion: '1.0.0' } }
      const result = await checker.validate(definition)
      assert.deepStrictEqual(result, definition)
    })

    it('returns undefined for a stale definition', async () => {
      const definition = { _meta: { schemaVersion: '0.1.0' } }
      const result = await checker.validate(definition)
      assert.strictEqual(result, undefined)
    })

    it('returns undefined for a definition without schema version', async () => {
      const definition = {}
      const result = await checker.validate(definition)
      assert.strictEqual(result, undefined)
    })

    it('handles null', async () => {
      checker.currentSchema = '1.0.0'
      const result = await checker.validate(null)
      assert.ok(!result)
    })
  })
})
