// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RequestHandler } from 'express'
import type { Octokit } from '@octokit/rest'
import type { ICache } from '../providers/caching'

/**
 * GitHub user information retrieved from the GitHub API.
 */
export interface GitHubUserInfo {
  /** User's display name */
  name: string | null
  /** User's GitHub login/username */
  login: string
  /** User's email address */
  email: string | null
}

/**
 * GitHub-related data and methods attached to the request.
 */
export interface GitHubUserContext {
  /** The authenticated GitHub API client for the user (null if anonymous) */
  client: Octokit | null
  /** Cached user info, populated after getInfo() is called */
  _info?: GitHubUserInfo
  /** Cached team names, populated after getTeams() is called */
  _teams?: string[]
  /**
   * Retrieves the authenticated user's GitHub profile information.
   * Results are cached for performance.
   *
   * @returns User info including name, login, and email
   */
  getInfo(): Promise<GitHubUserInfo>
  /**
   * Retrieves the list of team names the user belongs to in the configured org.
   * Results are cached for performance.
   *
   * @returns Array of team names, or empty array if anonymous/no teams
   */
  getTeams(): Promise<string[]>
}

/**
 * Service-level GitHub context attached to the request.
 */
export interface GitHubServiceContext {
  /** The authenticated GitHub API client using the service token */
  client: Octokit
}

/**
 * Options for configuring the GitHub middleware.
 */
export interface GitHubMiddlewareOptions {
  /** GitHub Personal Access Token for service-level operations */
  token: string
  /** GitHub organization name for filtering team memberships */
  org: string
}

/**
 * Express application locals extended with GitHub contexts.
 * These are attached by the GitHub middleware.
 */
export interface GitHubAppLocals {
  /** User-level GitHub context */
  user: {
    github: GitHubUserContext
  }
  /** Service-level GitHub context */
  service: {
    github: GitHubServiceContext
  }
}

/**
 * Factory function that creates the GitHub middleware.
 *
 * The middleware:
 * - Creates a service-level GitHub client using the configured token
 * - Creates a user-level GitHub client if a Bearer token is provided
 * - Attaches `getInfo()` and `getTeams()` methods to `req.app.locals.user.github`
 * - Caches user info and team data for performance
 *
 * @param authOptions - Configuration options including token and org
 * @param authCache - Cache instance for storing user info and team data
 * @returns Express middleware
 *
 * @example
 * ```js
 * const githubMiddleware = require('./github')
 * const memoryCache = require('../providers/caching/memory')
 *
 * const cache = memoryCache({ defaultTtlSeconds: 600 })
 * app.use(githubMiddleware({ token: 'ghp_...', org: 'myorg' }, cache))
 * ```
 */
declare function createGithubMiddleware(authOptions: GitHubMiddlewareOptions, authCache: ICache): RequestHandler

export default createGithubMiddleware
export = createGithubMiddleware
