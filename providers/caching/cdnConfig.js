// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const cdn = require('./cdn')

function serviceFactory(options) {
  const realOptions = options || {
    flushByTagUrl: config.get('CDN_FLUSHBYTAG_ENDPOINT'),
    apiEmail: config.get('CDN_AUTH_EMAIL'),
    apiKey: config.get('CDN_AUTH_KEY')
  }
  return cdn(realOptions)
}

module.exports = serviceFactory
