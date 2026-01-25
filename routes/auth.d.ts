// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { Strategy as GitHubStrategy } from 'passport-github'
import type { PermissionsConfig } from '../middleware/permissions'

/**
 * Configuration options for the auth route module.
 */
export interface AuthOptions {
  /** GitHub OAuth App client ID (optional, falls back to PAT auth if not set) */
  clientId?: string
  /** GitHub OAuth App client secret */
  clientSecret?: string
  /** GitHub Personal Access Token for service-level operations */
  token: string
  /** GitHub organization name for filtering team memberships */
  org: string
  /** Permission configuration mapping permission names to team names */
  permissions: PermissionsConfig
}

/**
 * Endpoint URLs for OAuth callbacks and redirects.
 */
export interface AuthEndpoints {
  /** URL of the service API (used for OAuth callback URL) */
  service: string
  /** URL of the website/frontend (used for postMessage origin) */
  website: string
}

/**
 * GitHub user email information.
 */
export interface GitHubEmail {
  /** Email address */
  email: string
  /** Whether this is the primary email */
  primary: boolean
  /** Whether the email is verified */
  verified: boolean
  /** Email visibility setting */
  visibility: string | null
}

/**
 * Result from getUserDetails containing user permissions and email.
 */
export interface UserDetails {
  /** The user's public email, if available */
  publicEmails: GitHubEmail | undefined
  /** List of permission names the user has based on team membership */
  permissions: string[]
}

/**
 * GitHub OAuth authentication route module.
 *
 * This module provides Express routes for GitHub OAuth authentication,
 * including handling the OAuth flow and extracting user permissions
 * based on GitHub team membership.
 *
 * Routes:
 * - GET /github - Initiates the OAuth flow
 * - GET /github/start - Handles OAuth redirect or PAT fallback
 * - GET /github/finalize - Completes OAuth and returns token to frontend
 */
declare namespace authRoute {
  /**
   * Configuration options for the auth route module.
   */
  export interface AuthOptions {
    /** GitHub OAuth App client ID (optional, falls back to PAT auth if not set) */
    clientId?: string
    /** GitHub OAuth App client secret */
    clientSecret?: string
    /** GitHub Personal Access Token for service-level operations */
    token: string
    /** GitHub organization name for filtering team memberships */
    org: string
    /** Permission configuration mapping permission names to team names */
    permissions: PermissionsConfig
  }

  /**
   * Endpoint URLs for OAuth callbacks and redirects.
   */
  export interface AuthEndpoints {
    /** URL of the service API (used for OAuth callback URL) */
    service: string
    /** URL of the website/frontend (used for postMessage origin) */
    website: string
  }

  /**
   * GitHub user email information.
   */
  export interface GitHubEmail {
    /** Email address */
    email: string
    /** Whether this is the primary email */
    primary: boolean
    /** Whether the email is verified */
    verified: boolean
    /** Email visibility setting */
    visibility: string | null
  }

  /**
   * Result from getUserDetails containing user permissions and email.
   */
  export interface UserDetails {
    /** The user's public email, if available */
    publicEmails: GitHubEmail | undefined
    /** List of permission names the user has based on team membership */
    permissions: string[]
  }

  /**
   * Express router handling /auth/github routes.
   *
   * Mount this router at `/auth` in your Express app:
   * ```js
   * app.use('/auth', authModule.router)
   * ```
   */
  export const router: Router

  /**
   * Configures the auth module with options and endpoints.
   * Must be called before using the router.
   *
   * @param options - Authentication configuration options
   * @param endpoints - Service endpoint URLs for OAuth callbacks
   *
   * @example
   * ```js
   * authRoute.setup({
   *   clientId: 'github-oauth-client-id',
   *   clientSecret: 'github-oauth-secret',
   *   token: 'ghp_...',
   *   org: 'myorg',
   *   permissions: { harvest: ['harvest-team'], curate: ['curation-team'] }
   * }, {
   *   service: 'https://api.example.com',
   *   website: 'https://example.com'
   * })
   * ```
   */
  export function setup(options: AuthOptions, endpoints: AuthEndpoints): void

  /**
   * Returns whether passport should be used for OAuth authentication.
   * Returns true if a clientId is configured, false otherwise (uses PAT).
   *
   * @returns True if OAuth is configured, false if using PAT fallback
   */
  export function usePassport(): boolean

  /**
   * Creates and returns the Passport GitHub strategy for OAuth.
   * Should only be called after setup() and if usePassport() returns true.
   *
   * @returns Configured Passport GitHub strategy
   *
   * @example
   * ```js
   * if (authRoute.usePassport()) {
   *   passport.use(authRoute.getStrategy())
   * }
   * ```
   */
  export function getStrategy(): GitHubStrategy
}

export = authRoute
