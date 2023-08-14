// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')
const mongo = require('./mongo')
const TrimmedMongoDefinitionStore = require('./trimmedMongoDefinitionStore')

const dbOptions = {
  connectionString: config.get('DEFINITION_MONGO_CONNECTION_STRING'),
  dbName: config.get('DEFINITION_MONGO_DB_NAME') || 'clearlydefined'
}

function definitionPaged(options) {
  return mongo(options || {
    ...dbOptions,
    collectionName: config.get('DEFINITION_MONGO_COLLECTION_NAME') || 'definitions-paged'
  })
}

function definitionTrimmed(options) {
  return TrimmedMongoDefinitionStore(options || {
    ...dbOptions,
    collectionName: config.get('DEFINITION_MONGO_TRIMMED_COLLECTION_NAME') || 'definitions-trimmed'
  })
}

module.exports = { definitionPaged, definitionTrimmed }
