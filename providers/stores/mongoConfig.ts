// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { MongoDefinitionStoreOptions } from './abstractMongoDefinitionStore.ts'
import mongo from './mongo.ts'
import TrimmedMongoDefinitionStore from './trimmedMongoDefinitionStore.ts'

const dbOptions = {
  connectionString: config.get('DEFINITION_MONGO_CONNECTION_STRING'),
  dbName: config.get('DEFINITION_MONGO_DB_NAME') || 'clearlydefined'
}

/**
 * Creates a paged MongoDB definition store with the given options or default configuration.
 * This store supports large definitions by paginating file data across multiple documents.
 */
function definitionPaged(options?: MongoDefinitionStoreOptions) {
  return mongo(
    options || ({
      ...dbOptions,
      collectionName: config.get('DEFINITION_MONGO_COLLECTION_NAME') || 'definitions-paged'
    } as MongoDefinitionStoreOptions)
  )
}

/**
 * Creates a trimmed MongoDB definition store with the given options or default configuration.
 * This store saves definitions without file data for faster queries.
 */
function definitionTrimmed(options?: MongoDefinitionStoreOptions) {
  const oldConfig = config.get('TRIMMED_DEFINITION_MONGO_COLLECTION_NAME')
  if (oldConfig) {
    console.warn(
      'The TRIMMED_DEFINITION_MONGO_COLLECTION_NAME environment variable is deprecated. Use DEFINITION_MONGO_TRIMMED_COLLECTION_NAME instead.'
    )
  }
  return TrimmedMongoDefinitionStore(
    options || ({
      ...dbOptions,
      collectionName: config.get('DEFINITION_MONGO_TRIMMED_COLLECTION_NAME') || oldConfig || 'definitions-trimmed'
    } as MongoDefinitionStoreOptions)
  )
}

export default { definitionPaged, definitionTrimmed }
