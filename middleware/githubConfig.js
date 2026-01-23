// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').RequestHandler} RequestHandler */
/** @typedef {import('../providers/caching').ICache} ICache */
/** @typedef {import('./githubConfig').GitHubConfigOptions} GitHubConfigOptions */
/** @typedef {import('../routes/auth').AuthEndpoints} AuthEndpoints */
/** @typedef {import('../routes/auth')} AuthRouteModule */
/** @typedef {import('./permissions').PermissionsConfig} PermissionsConfig */

const config = require('painless-config')
const githubMiddleware = require('./github')
const githubRoute = require('../routes/auth')
const permissions = require('./permissions')
const memoryCache = require('../providers/caching/memory')

/** @type {GitHubConfigOptions} */
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
const defaultCache = memoryCache({ defaultTtlSeconds: 10 * 60 /* 10 mins */ })

/**
 * Creates the GitHub authentication middleware with optional custom configuration.
 *
 * @param {GitHubConfigOptions} [options] - GitHub configuration options (uses defaults if not provided)
 * @param {ICache} [cache] - Cache instance for storing user data (uses memory cache if not provided)
 * @returns {RequestHandler} Express middleware for GitHub authentication
 */
function middleware(options, cache) {
  const realOptions = options || defaultOptions
  const realCache = cache || defaultCache
  return githubMiddleware(realOptions, realCache)
}

/**
 * Sets up and returns the GitHub OAuth authentication route module.
 *
 * @param {GitHubConfigOptions} [options] - GitHub configuration options (uses defaults if not provided)
 * @param {AuthEndpoints} [endpoints] - Service endpoint URLs for OAuth callbacks
 * @returns {AuthRouteModule} The auth route module (use `.router` property to mount in Express)
 */
function route(options, endpoints) {
  githubRoute.setup(options || defaultOptions, endpoints)
  return /** @type {AuthRouteModule} */ (githubRoute)
}

/**
 * Sets up the permissions module with the given options.
 *
 * @param {PermissionsConfig} [options] - Permission configuration (uses defaults if not provided)
 */
function permissionsSetup(options) {
  permissions.setup(options || defaultOptions.permissions)
}

module.exports = { middleware, route, permissionsSetup }
