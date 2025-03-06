// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
process.env['CURATION_GITHUB_TOKEN'] = '123'
process.env['GITLAB_TOKEN'] = 'abc'
const init = require('express-init')
const Application = require('../app')
const logger = require('../providers/logging/logger')
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

const mockLogger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

describe('Application', () => {
  beforeEach(async () => {
    logger(mockLogger)
  })

  it.skip('should initialize', done => {
    const app = Application(config, {
      logger: mockLogger,
      cachingService: {}
    })
    init(app, error => {
      if (error) {
        done(error)
      }
      done()
    })
  }).timeout(5000)
})
