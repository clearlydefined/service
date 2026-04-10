// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RequestHandler } from 'express'
import config from 'painless-config'
import type { ICache } from '../providers/caching/index.js'
import memoryCache from '../providers/caching/memory.ts'
import type { AuthEndpoints } from '../routes/auth.js'
import * as githubRoute from '../routes/auth.js'
import type { GitHubMiddlewareOptions } from './github.ts'
import githubMiddleware from './github.ts'
import type { PermissionsConfig } from './permissions.ts'
import * as permissions from './permissions.ts'

/**
 * Extended options for GitHub authentication configuration.
 * Includes OAuth app credentials and permission mappings.
 */
export interface GitHubConfigOptions extends GitHubMiddlewareOptions {
  clientId?: string
  clientSecret?: string
  permissions: PermissionsConfig
}

const defaultOptions: GitHubConfigOptions = {
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
 */
function middleware(options?: GitHubConfigOptions, cache?: ICache): RequestHandler {
  const realOptions = options || defaultOptions
  const realCache = cache || defaultCache
  return githubMiddleware(realOptions, realCache)
}

/**
 * Sets up and returns the GitHub OAuth authentication route module.
 */
function route(options?: GitHubConfigOptions, endpoints?: AuthEndpoints): typeof githubRoute {
  githubRoute.setup(options || defaultOptions, endpoints)
  return githubRoute
}

/**
 * Sets up the permissions module with the given options.
 */
function permissionsSetup(options?: PermissionsConfig): void {
  permissions.setup(options || defaultOptions.permissions)
}

export default { middleware, route, permissionsSetup }
