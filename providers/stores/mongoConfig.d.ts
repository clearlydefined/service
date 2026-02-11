// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { MongoDefinitionStoreOptions } from './abstractMongoDefinitionStore'
import type { MongoStore } from './mongo'
import type { TrimmedMongoDefinitionStore } from './trimmedMongoDefinitionStore'

/**
 * Creates a paged MongoDB definition store with the given options or default configuration.
 * This store supports large definitions by paginating file data across multiple documents.
 *
 * @param options - Optional configuration options for the store
 * @returns A new MongoStore instance
 */
export function definitionPaged(options?: MongoDefinitionStoreOptions): MongoStore

/**
 * Creates a trimmed MongoDB definition store with the given options or default configuration.
 * This store saves definitions without file data for faster queries.
 *
 * @param options - Optional configuration options for the store
 * @returns A new TrimmedMongoDefinitionStore instance
 */
export function definitionTrimmed(options?: MongoDefinitionStoreOptions): TrimmedMongoDefinitionStore
