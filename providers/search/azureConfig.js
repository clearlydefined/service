// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const search = require('./azureSearch')

function serviceFactory(options) {
  const realOptions = options || {
    service: config.get('SEARCH_AZURE_SERVICE'),
    apiKey: config.get('SEARCH_AZURE_API_KEY'),
    dataSourceConnectionString:
      config.get('SEARCH_AZURE_DATASOURCE_CONNECTION_STRING') ||
      config.get('DEFINITION_AZBLOB_CONNECTION_STRING') ||
      config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
    dataSourceContainerName:
      config.get('SEARCH_AZURE_DATASOURCE_CONTAINER_NAME') ||
      config.get('DEFINITION_AZBLOB_CONTAINER_NAME') ||
      config.get('HARVEST_AZBLOB_CONTAINER_NAME') + '-definition'
  }
  return search(realOptions)
}

module.exports = serviceFactory
