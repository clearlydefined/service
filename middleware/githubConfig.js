// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')
const githubMiddleware = require('./github')
const githubRoute = require('../routes/auth')
const permissions = require('./permissions')
const memoryCache = require('../providers/caching/memory')

const defaultOptions = {
  clientId: config.get('AUTH_GITHUB_CLIENT_ID'),
  clientSecret: config.get('AUTH_GITHUB_CLIENT_SECRET'),
  token: config.get('CURATION_GITHUB_TOKEN'),
  org: config.get('AUTH_GITHUB_ORG') || 'clearlydefined',
  permissions: {
    harvest: [config.get('AUTH_HARVEST_TEAM') || 'harvest-dev'],
    curate: [config.get('AUTH_CURATION_TEAM'), 'curation-dev']
  }
}
const defaultCache = memoryCache({ defaultExpirationSeconds: 10 * 60 /* 10 mins */ })

function middleware(options, cache) {
  const realOptions = options || defaultOptions
  const realCache = cache || defaultCache
  return githubMiddleware(realOptions, realCache)
}

function route(options, endpoints) {
  githubRoute.setup(options || defaultOptions, endpoints)
  return githubRoute
}

function permissionsSetup(options) {
  permissions.setup(options || defaultOptions.permissions)
}

module.exports = { middleware, route, permissionsSetup }
