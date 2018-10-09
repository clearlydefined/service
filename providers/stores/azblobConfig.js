// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')

const harvestConnectionString = config.get('HARVEST_AZBLOB_CONNECTION_STRING')
const harvestContainerName = config.get('HARVEST_AZBLOB_CONTAINER_NAME')
const definitionConnectionString = config.get('DEFINITION_AZBLOB_CONNECTION_STRING') || harvestConnectionString
const definitionContainerName = config.get('DEFINITION_AZBLOB_CONTAINER_NAME') || harvestContainerName + '-definition'
const attachmentConnectionString = config.get('ATTACHMENT_AZBLOB_CONNECTION_STRING') || harvestConnectionString
const attachmentContainerName = config.get('ATTACHMENT_AZBLOB_CONTAINER_NAME') || harvestContainerName

function harvest(options) {
  require('./azblobHarvestStore')(
    options || {
      connectionString: harvestConnectionString,
      containerName: harvestContainerName
    }
  )
}

function definition(options) {
  require('./azblobDefinitionStore')(
    options || {
      connectionString: definitionConnectionString,
      containerName: definitionContainerName
    }
  )
}

function attachment(options) {
  require('./azblobAttachmentStore')(
    options || {
      connectionString: attachmentConnectionString,
      containerName: attachmentContainerName
    }
  )
}

module.exports = { harvest, definition, attachment }
