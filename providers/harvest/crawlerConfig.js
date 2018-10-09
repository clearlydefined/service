// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const crawler = require('./crawler')

function serviceFactory(options, endpoints) {
  const realOptions = options || {
    authToken: config.get('CRAWLER_API_AUTH_TOKEN'),
    url: config.get('CRAWLER_API_URL') || 'http://localhost:5000'
  }
  return crawler(realOptions)
}

module.exports = serviceFactory
