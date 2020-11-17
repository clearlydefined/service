// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
process.env['CURATION_GITHUB_TOKEN'] = '123'
const init = require('express-init')
const Application = require('../app')
const config = proxyquire('../bin/config', {
  ['painless-config']: {
    get: () => null
  }
})

describe('Application', () => {
  it('should initialize', (done) => {
    const app = Application(config)
    init(app, error => {
      if (error) {
        done(error)
      }
      done()
    })
  }).timeout(5000)
})
