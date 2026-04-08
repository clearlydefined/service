// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import assert from 'node:assert'
import esmock from 'esmock'
import sinon from 'sinon'
import Application from '../app.js'

process.env['CURATION_GITHUB_TOKEN'] = '123'
process.env['GITLAB_TOKEN'] = 'abc'

const config = await esmock('../bin/config.js', {
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
  let clock: sinon.SinonFakeTimers
  let sandbox: sinon.SinonSandbox

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
      (process.on as sinon.SinonStub).calledWithMatch('unhandledRejection'),
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
