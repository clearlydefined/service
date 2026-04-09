// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Octokit } from '@octokit/rest'
import { defaultHeaders } from './fetch.ts'

/**
 * @typedef {import('./github').GitHubClientOptions} GitHubClientOptions
 *
 * @typedef {import('./github').GitHubClient} GitHubClient
 */

/**
 * GitHub service module for creating authenticated GitHub API clients. Provides utilities for interacting with the
 * GitHub API using the Octokit library.
 */

/**
 * Creates an authenticated GitHub API client with default headers. The client is configured with the ClearlyDefined
 * user agent and authentication token.
 *
 * @param {GitHubClientOptions} options - Configuration options for the GitHub client
 * @returns {GitHubClient} Authenticated GitHub API client instance ready for making API calls
 * @throws {Error} When the provided token is invalid or authentication fails
 */
const getClient = options => {
  const config = {
    headers: defaultHeaders,
    ...(options?.token ? { auth: options.token } : {})
  }

  const github = new Octokit(config)
  return github
}

export { getClient }
