// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * GitHub API client instance from @octokit/rest package. This represents the authenticated GitHub client with all
 * available API methods.
 */
export type GitHubClient = import('@octokit/rest').Octokit

/** Options for configuring GitHub client authentication. */
export interface GitHubClientOptions {
  /** GitHub API token for authentication. */
  token: string
}

/** GitHub service module for creating authenticated GitHub API clients. */
export interface GitHubService {
  /**
   * Creates an authenticated GitHub API client.
   *
   * @param options - Configuration options including the GitHub token
   * @returns Authenticated GitHub API client instance
   */
  getClient(options: GitHubClientOptions): GitHubClient
}

declare const githubService: GitHubService
export = githubService
