// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('../bin/config')
process.env['CURATION_GITHUB_TOKEN'] = '123'
const init = require('express-init')
const Application = require('../app')

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
