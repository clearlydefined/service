// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { MongoCurationStoreOptions } from './mongoCurationStore.ts'
import storeFactory from './mongoCurationStore.ts'

function store(options?: MongoCurationStoreOptions) {
  const realOptions: MongoCurationStoreOptions = options || {
    connectionString: config.get('CURATION_MONGO_CONNECTION_STRING')!,
    dbName: config.get('CURATION_MONGO_DB_NAME') || 'clearlydefined',
    collectionName: config.get('CURATION_MONGO_COLLECTION_NAME') || 'curations'
  }
  return storeFactory(realOptions)
}

export default store
