// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const assert = require('assert')
const Application = require('../app')

process.env['CURATION_GITHUB_TOKEN'] = '123'
process.env['GITLAB_TOKEN'] = 'abc'

const config = proxyquire('../bin/config', {
  ['painless-config']: {
    get: name => {
      return (
        {
          WEBHOOK_GITHUB_SECRET: 'secret',
          WEBHOOK_CRAWLER_SECRET: 'secret'
        }[name] || null
      )
    }
  }
})

describe('Application', () => {
  let clock
  let originalUnhandledListeners

  beforeEach(() => {
    // Save original listeners before setting up fake timers
    originalUnhandledListeners = process.listeners('unhandledRejection').slice()
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
    // Clean up any new listeners added during the test
    process.removeAllListeners('unhandledRejection')
    // Restore original listeners
    originalUnhandledListeners.forEach(listener => {
      process.on('unhandledRejection', listener)
    })
  })

  it('should return a valid Express app instance', () => {
    const app = Application(config)

    assert.ok(app, 'App was not created')
    assert.strictEqual(typeof app.use, 'function', 'App is not an Express instance')
  })

  it('should expose basic HTTP method handlers (get, post, listen)', () => {
    const app = Application(config)
    assert.ok(app.get)
    assert.ok(app.post)
    assert.ok(app.listen)
  })
})
