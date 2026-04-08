// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Gitlab } from '@gitbeaker/rest'

/** Options for creating a GitLab client instance. */
export interface GitlabClientOptions {
  /** GitLab personal access token for authentication. */
  token?: string
}

/**
 * Creates and configures a GitLab client instance.
 *
 * @param options - Configuration options for the GitLab client
 * @returns A configured GitLab client instance
 */
export function getClient(options?: GitlabClientOptions): Gitlab
