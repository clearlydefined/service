// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
process.env['CURATION_GITHUB_TOKEN'] = '123'
process.env['GITLAB_TOKEN'] = 'abc'
const init = require('express-init')
const Application = require('../app')
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
  it('should initialize', done => {
    const app = Application(config)
    init(app, error => {
      if (error) {
        done(error)
      }
      done()
    })
  }).timeout(5000)
})
