// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RequestHandler } from 'express'
import type { ICache } from '../providers/caching'
import type { GitHubMiddlewareOptions } from './github'
import type { PermissionsConfig } from './permissions'
import type authRoute from '../routes/auth'

/**
 * Extended options for GitHub authentication configuration.
 * Includes OAuth app credentials and permission mappings.
 */
export interface GitHubConfigOptions extends GitHubMiddlewareOptions {
  /** GitHub OAuth App client ID (optional, falls back to PAT auth if not set) */
  clientId?: string
  /** GitHub OAuth App client secret */
  clientSecret?: string
  /** Permission configuration mapping permission names to team names */
  permissions: PermissionsConfig
}

// Re-export AuthEndpoints from routes/auth for convenience
export type AuthEndpoints = authRoute.AuthEndpoints

/**
 * Creates the GitHub authentication middleware with optional custom configuration.
 *
 * @param options - GitHub configuration options (uses defaults from environment if not provided)
 * @param cache - Cache instance for storing user data (uses memory cache if not provided)
 * @returns Express middleware for GitHub authentication
 *
 * @example
 * ```js
 * const { middleware } = require('./githubConfig')
 *
 * // Use defaults from environment variables
 * app.use(middleware())
 *
 * // Or provide custom options
 * app.use(middleware({ token: 'ghp_...', org: 'myorg' }, myCache))
 * ```
 */
export function middleware(options?: GitHubConfigOptions, cache?: ICache): RequestHandler

/**
 * Sets up and returns the GitHub OAuth authentication route module.
 *
 * @param options - GitHub configuration options (uses defaults from environment if not provided)
 * @param endpoints - Service endpoint URLs for OAuth callbacks
 * @returns The auth route module (use `.router` property to mount in Express)
 *
 * @example
 * ```js
 * const { route } = require('./githubConfig')
 *
 * const authModule = route(null, {
 *   service: 'https://api.example.com',
 *   website: 'https://example.com'
 * })
 * app.use('/auth', authModule.router)
 * ```
 */
export function route(options?: GitHubConfigOptions, endpoints?: AuthEndpoints): typeof authRoute

/**
 * Sets up the permissions module with the given options.
 *
 * @param options - Permission configuration (uses defaults from environment if not provided)
 *
 * @example
 * ```js
 * const { permissionsSetup } = require('./githubConfig')
 *
 * permissionsSetup({
 *   harvest: ['harvest-team'],
 *   curate: ['curation-team']
 * })
 * ```
 */
export function permissionsSetup(options?: PermissionsConfig): void
