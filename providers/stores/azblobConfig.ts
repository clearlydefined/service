// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./abstractAzblobStore').AzBlobStoreOptions} AzBlobStoreOptions
 * @typedef {import('./azblobAttachmentStore').AzBlobAttachmentStoreOptions} AzBlobAttachmentStoreOptions
 */

import config from 'painless-config'
import azblobAttachmentStore from './azblobAttachmentStore.js'
import azblobDefinitionStore from './azblobDefinitionStore.js'
import azblobHarvestStore from './azblobHarvestStore.js'

const harvestConnectionString = config.get('HARVEST_AZBLOB_CONNECTION_STRING')
const harvestContainerName = config.get('HARVEST_AZBLOB_CONTAINER_NAME')
const definitionConnectionString = config.get('DEFINITION_AZBLOB_CONNECTION_STRING') || harvestConnectionString
const definitionContainerName = config.get('DEFINITION_AZBLOB_CONTAINER_NAME') || `${harvestContainerName}-definition`
const attachmentConnectionString = config.get('ATTACHMENT_AZBLOB_CONNECTION_STRING') || harvestConnectionString
const attachmentContainerName = config.get('ATTACHMENT_AZBLOB_CONTAINER_NAME') || harvestContainerName

/**
 * Creates an Azure Blob harvest store with the given options or default configuration.
 *
 * @param {AzBlobStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./azblobHarvestStore')>} A new AzHarvestBlobStore instance
 */
function harvest(options) {
  return azblobHarvestStore(
    options || {
      connectionString: harvestConnectionString,
      containerName: harvestContainerName
    }
  )
}

/**
 * Creates an Azure Blob definition store with the given options or default configuration.
 *
 * @param {AzBlobStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./azblobDefinitionStore')>} A new AzBlobDefinitionStore instance
 */
function definition(options) {
  return azblobDefinitionStore(
    options || {
      connectionString: definitionConnectionString,
      containerName: definitionContainerName
    }
  )
}

/**
 * Creates an Azure Blob attachment store with the given options or default configuration.
 *
 * @param {AzBlobAttachmentStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./azblobAttachmentStore')>} A new AzBlobAttachmentStore instance
 */
function attachment(options) {
  return azblobAttachmentStore(
    options || {
      connectionString: attachmentConnectionString,
      containerName: attachmentContainerName
    }
  )
}

export default { harvest, definition, attachment }
