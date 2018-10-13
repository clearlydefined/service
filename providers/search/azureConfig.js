// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const search = require('./azureSearch')

function serviceFactory(options, endpoints) {
  const realOptions = options || {
    service: config.get('SEARCH_AZURE_SERVICE'),
    apiKey: config.get('SEARCH_AZURE_API_KEY')
  }
  return search(realOptions)
}

module.exports = serviceFactory
