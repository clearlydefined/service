// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import sinon from 'sinon'

const proxyquire = require('proxyquire')
const Application = require('../app')

process.env['CURATION_GITHUB_TOKEN'] = '123'
process.env['GITLAB_TOKEN'] = 'abc'

const config = proxyquire('../bin/config', {
  ['painless-config']: {
    get: (name: string) => {
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
  let clock: any
  let sandbox: any

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    // Stub process.on to prevent the Application from adding unhandledRejection listeners during tests
    sandbox.stub(process, 'on')
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
    sandbox.restore()
  })

  it('should return a valid Express app instance', () => {
    const app = Application(config)

    assert.ok(app, 'App was not created')
    assert.strictEqual(typeof app.use, 'function', 'App is not an Express instance')
    // Verify that process.on was called to add unhandledRejection listener
    assert.ok(
      (process.on as ReturnType<typeof mock.fn>).calledWithMatch('unhandledRejection'),
      'Application should attempt to add unhandledRejection listener'
    )
  })

  it('should expose basic HTTP method handlers (get, post, listen)', () => {
    const app = Application(config)
    assert.ok(app.get)
    assert.ok(app.post)
    assert.ok(app.listen)
  })
})
