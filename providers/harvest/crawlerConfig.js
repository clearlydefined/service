// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const crawler = require('./crawler')

function serviceFactory(options, endpoints) {
  const realOptions = options || {
    authToken: config.get('CRAWLER_SERVICE_AUTH_TOKEN'),
    url: config.get('CRAWLER_SERVICE_URL')
  }
  return crawler(realOptions)
}

module.exports = serviceFactory
