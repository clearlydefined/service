// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('../bin/config')
const app = require('../app')(config)
const init = require('express-init')

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  const port = parseInt(val, 10)
  // named pipe
  if (isNaN(port)) return val
  // port number
  if (port >= 0) return port
  return false
}

describe('Application', () => {
  it('should initialize', async () => {
    const port = normalizePort(process.env.PORT || '4000')
    app.set('port', port)
    await init(app, error => {
      if (error) {
        throw new Error(error)
      }
    })
  })
})
