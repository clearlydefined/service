// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Gitlab } from '@gitbeaker/rest'

/** Options for creating a GitLab client instance. */
export interface GitlabClientOptions {
  /** GitLab personal access token for authentication. */
  token?: string
}

/**
 * Creates and configures a GitLab client instance with standard headers and authentication token.
 */
const getClient = (options?: GitlabClientOptions): InstanceType<typeof Gitlab> => {
  const gitlab = new Gitlab({
    ...(options?.token ? { token: options.token } : {})
  } as ConstructorParameters<typeof Gitlab>[0])
  return gitlab
}

export { getClient }
