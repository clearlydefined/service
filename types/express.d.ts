// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Express type augmentations for the ClearlyDefined service.
 * This file extends Express types to include custom properties used throughout the application.
 */

import type { Octokit } from '@octokit/rest'
import type { GitHubUserInfo } from '../middleware/github'

/**
 * GitHub user context attached to app.locals.user
 */
interface GitHubUserLocals {
  /** The authenticated GitHub API client for the user (null if anonymous) */
  client: Octokit | null
  /** Cached user info, populated after getInfo() is called */
  _info?: GitHubUserInfo
  /** Cached team names, populated after getTeams() is called */
  _teams?: string[]
  /**
   * Retrieves the authenticated user's GitHub profile information.
   * @returns User info including name, login, and email
   */
  getInfo?: () => Promise<GitHubUserInfo>
  /**
   * Retrieves the list of team names the user belongs to in the configured org.
   * @returns Array of team names, or empty array if anonymous/no teams
   */
  getTeams?: () => Promise<string[]>
}

/**
 * GitHub service context attached to app.locals.service
 */
interface GitHubServiceLocals {
  /** The authenticated GitHub API client using the service token */
  client: Octokit
}

/**
 * Custom user properties for GitHub authentication.
 * Used by passport-github and PAT fallback authentication.
 */
interface GitHubAuthUser {
  /** GitHub access token from OAuth or PAT */
  githubAccessToken: string
  /** GitHub username (available after OAuth) */
  username?: string
}

declare global {
  namespace Express {
    interface Locals {
      /** User-level context including GitHub client and methods */
      user: {
        github: GitHubUserLocals
      }
      /** Service-level context including GitHub client */
      service: {
        github: GitHubServiceLocals
      }
    }

    // Augment the User interface for passport
    interface User extends GitHubAuthUser {}
  }
}

export {}
