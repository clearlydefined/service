// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Gitlab } from '@gitbeaker/node'

/** Options for creating a GitLab client instance. */
export interface GitlabClientOptions {
  /** GitLab personal access token for authentication. */
  token?: string
}

/** GitLab client module providing utilities for interacting with GitLab API. */
export interface GitlabModule {
  /**
   * Creates and configures a GitLab client instance.
   *
   * @example
   *   ```javascript
   *   const client = gitlab.getClient({ token: 'your-token' })
   *   const project = await client.Projects.show('group/project')
   *   ```
   *
   * @param options - Configuration options for the GitLab client
   * @returns A configured GitLab client instance
   */
  getClient(options?: GitlabClientOptions): Gitlab
}

declare const gitlab: GitlabModule
export = gitlab
