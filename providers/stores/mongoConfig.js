// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./abstractMongoDefinitionStore').MongoDefinitionStoreOptions} MongoDefinitionStoreOptions
 */

const config = require('painless-config')
const mongo = require('./mongo')
const TrimmedMongoDefinitionStore = require('./trimmedMongoDefinitionStore')

const dbOptions = {
  connectionString: config.get('DEFINITION_MONGO_CONNECTION_STRING'),
  dbName: config.get('DEFINITION_MONGO_DB_NAME') || 'clearlydefined'
}

/**
 * Creates a paged MongoDB definition store with the given options or default configuration.
 * This store supports large definitions by paginating file data across multiple documents.
 *
 * @param {MongoDefinitionStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./mongo')>} A new MongoStore instance
 */
function definitionPaged(options) {
  return mongo(
    options || {
      ...dbOptions,
      collectionName: config.get('DEFINITION_MONGO_COLLECTION_NAME') || 'definitions-paged'
    }
  )
}

/**
 * Creates a trimmed MongoDB definition store with the given options or default configuration.
 * This store saves definitions without file data for faster queries.
 *
 * @param {MongoDefinitionStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./trimmedMongoDefinitionStore')>} A new TrimmedMongoDefinitionStore instance
 */
function definitionTrimmed(options) {
  const oldConfig = config.get('TRIMMED_DEFINITION_MONGO_COLLECTION_NAME')
  if (oldConfig) {
    console.warn(
      'The TRIMMED_DEFINITION_MONGO_COLLECTION_NAME environment variable is deprecated. Use DEFINITION_MONGO_TRIMMED_COLLECTION_NAME instead.'
    )
  }
  return TrimmedMongoDefinitionStore(
    options || {
      ...dbOptions,
      collectionName: config.get('DEFINITION_MONGO_TRIMMED_COLLECTION_NAME') || oldConfig || 'definitions-trimmed'
    }
  )
}

module.exports = { definitionPaged, definitionTrimmed }
