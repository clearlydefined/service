// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { AzureSearch, AzureSearchOptions } from './azureSearch'

/**
 * Factory that creates an AzureSearch instance using configuration from
 * environment variables (via painless-config). Falls back through several
 * config keys for the data source connection string and container name.
 *
 * @param options - Optional overrides; if omitted, reads from environment
 * @returns A new AzureSearch instance
 */
declare function serviceFactory(options?: Partial<AzureSearchOptions>): AzureSearch

export default serviceFactory
export = serviceFactory
