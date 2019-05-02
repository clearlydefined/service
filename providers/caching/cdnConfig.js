// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const cdn = require('./cdn')

function serviceFactory(options) {
  let realOptions = options || {
    flushByTagUrl: config.get('CDN_FLUSHBYTAG_ENDPOINT'),
    apiEmail: config.get('CDN_AUTH_EMAIL'),
    apiKey: config.get('CDN_AUTH_KEY'),
    watermark: parseInt(config.get('CDN_WATERMARK'))
  }
  if (isNaN(realOptions.watermark)) {
    realOptions.watermark = 30
  }
  return cdn(realOptions)
}

module.exports = serviceFactory
