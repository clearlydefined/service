// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('./mongoCurationStore').MongoCurationStoreOptions} MongoCurationStoreOptions */

import config from 'painless-config'
import storeFactory from './mongoCurationStore.js'

/** @param {MongoCurationStoreOptions} [options] */
function store(options) {
  const realOptions = options || {
    connectionString: config.get('CURATION_MONGO_CONNECTION_STRING'),
    dbName: config.get('CURATION_MONGO_DB_NAME') || 'clearlydefined',
    collectionName: config.get('CURATION_MONGO_COLLECTION_NAME') || 'curations'
  }
  return storeFactory(realOptions)
}

export default store
