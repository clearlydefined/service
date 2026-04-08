// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { MongoCurationStoreOptions } from './mongoCurationStore.js'
import type { MongoCurationStore } from './mongoCurationStore.js'

/**
 * Factory function that creates a MongoCurationStore configured for curation storage.
 * Reads `CURATION_MONGO_CONNECTION_STRING`, `CURATION_MONGO_DB_NAME`, and
 * `CURATION_MONGO_COLLECTION_NAME` from the environment when no options are provided.
 *
 * @param options - Optional override for store configuration
 * @returns A configured MongoCurationStore instance
 */
declare function store(options?: MongoCurationStoreOptions): MongoCurationStore

export default store
