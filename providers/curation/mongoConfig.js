// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const storeFactory = require('./mongoCurationStore')

function store(options) {
  const realOptions = options || {
    connectionString: config.get('CURATION_MONGO_CONNECTION_STRING'),
    dbName: config.get('CURATION_MONGO_DB_NAME') || 'clearlydefined',
    collectionName: config.get('CURATION_MONGO_COLLECTION_NAME') || 'curations'
  }
  return storeFactory(realOptions)
}

module.exports = store
