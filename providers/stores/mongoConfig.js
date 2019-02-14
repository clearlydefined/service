// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')
const mongo = require('./mongo')

function definition(options) {
  return mongo(
    options || {
      connectionString: config.get('DEFINITION_MONGO_CONNECTION_STRING'),
      dbName: config.get('DEFINITION_MONGO_DB_NAME') || 'clearlydefined',
      collectionName: config.get('DEFINITON_MONGO_COLLECTION_NAME') || 'definitions'
    }
  )
}

module.exports = definition
