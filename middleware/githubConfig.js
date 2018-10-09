// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')
const githubMiddleware = require('./github')
const githubRoute = require('../routes/auth')

const authOptions = {
  clientId: config.get('AUTH_GITHUB_CLIENT_ID'),
  clientSecret: config.get('AUTH_GITHUB_CLIENT_SECRET'),
  token: config.get('CURATION_GITHUB_TOKEN'),
  org: config.get('AUTH_GITHUB_ORG') || 'clearlydefined',
  timeouts: {
    info: 10 * 60 // 10 mins
  },
  permissions: {
    harvest: [config.get('AUTH_HARVEST_TEAM') || 'harvest-dev'],
    curate: [config.get('AUTH_CURATION_TEAM'), 'curation-dev']
  }
}

function middleware(options) {
  const realOptions = options || authOptions
  return githubMiddleware(realOptions)
}

function route(options, endpoints) {
  return githubRoute(options || authOptions, endpoints)
}

module.exports = { middleware, route }
