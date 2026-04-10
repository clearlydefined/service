// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { AzureSearchOptions } from './azureSearch.ts'
import search from './azureSearch.ts'

function serviceFactory(options?: Partial<AzureSearchOptions>) {
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
      `${config.get('HARVEST_AZBLOB_CONTAINER_NAME')}-definition`
  }
  return search(realOptions)
}

export default serviceFactory
