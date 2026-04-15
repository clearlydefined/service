// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { AzBlobStoreOptions } from './abstractAzblobStore.ts'
import azblobAttachmentStore from './azblobAttachmentStore.ts'
import azblobDefinitionStore from './azblobDefinitionStore.ts'
import azblobHarvestStore from './azblobHarvestStore.ts'

const harvestConnectionString = config.get('HARVEST_AZBLOB_CONNECTION_STRING')
const harvestContainerName = config.get('HARVEST_AZBLOB_CONTAINER_NAME')
const definitionConnectionString = config.get('DEFINITION_AZBLOB_CONNECTION_STRING') || harvestConnectionString
const definitionContainerName = config.get('DEFINITION_AZBLOB_CONTAINER_NAME') || `${harvestContainerName}-definition`
const attachmentConnectionString = config.get('ATTACHMENT_AZBLOB_CONNECTION_STRING') || harvestConnectionString
const attachmentContainerName = config.get('ATTACHMENT_AZBLOB_CONTAINER_NAME') || harvestContainerName

/**
 * Creates an Azure Blob harvest store with the given options or default configuration.
 */
function harvest(options?: AzBlobStoreOptions) {
  return azblobHarvestStore(
    options || ({
      connectionString: harvestConnectionString,
      containerName: harvestContainerName
    } as AzBlobStoreOptions)
  )
}

/**
 * Creates an Azure Blob definition store with the given options or default configuration.
 */
function definition(options?: AzBlobStoreOptions) {
  return azblobDefinitionStore(
    options || ({
      connectionString: definitionConnectionString,
      containerName: definitionContainerName
    } as AzBlobStoreOptions)
  )
}

/**
 * Creates an Azure Blob attachment store with the given options or default configuration.
 */
function attachment(options?: AzBlobStoreOptions) {
  return azblobAttachmentStore(
    options || ({
      connectionString: attachmentConnectionString,
      containerName: attachmentContainerName
    } as AzBlobStoreOptions)
  )
}

export default { harvest, definition, attachment }
