// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const redis = require('./redis')
const config = require('painless-config')

function serviceFactory(options) {
  const realOptions = options || {
    service: config.get('CACHING_REDIS_SERVICE'),
    apiKey: config.get('CACHING_REDIS_API_KEY')
  }
  return redis(realOptions)
}

module.exports = serviceFactory
