// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Octokit } from '@octokit/rest'
import { defaultHeaders } from './fetch.ts'

/** GitHub API client instance from @octokit/rest package. */
export type GitHubClient = Octokit

/** Options for configuring GitHub client authentication. */
export interface GitHubClientOptions {
  /** GitHub API token for authentication. */
  token: string
}

/**
 * Creates an authenticated GitHub API client with default headers.
 */
const getClient = (options: GitHubClientOptions): GitHubClient => {
  const config = {
    headers: defaultHeaders,
    ...(options?.token ? { auth: options.token } : {})
  }

  const github = new Octokit(config)
  return github
}

export { getClient }
