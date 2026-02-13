// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const crawler = require('./crawler')
const cacheBasedCrawler = require('./cacheBasedCrawler')

const crawlerConfig = {
  authToken: config.get('CRAWLER_API_AUTH_TOKEN'),
  url: config.get('CRAWLER_API_URL') || 'http://localhost:5000'
}

function serviceFactory(options) {
  const crawlerOptions = { ...crawlerConfig, ...options }
  const harvester = crawler(crawlerOptions)
  const cacheTTLSeconds = parseInt(config.get('HARVEST_CACHE_TTL_IN_SECONDS'), 10)
  const cacheTTLInSeconds = Number.isFinite(cacheTTLSeconds) && cacheTTLSeconds > 0 ? cacheTTLSeconds : undefined
  return cacheBasedCrawler({ ...options, cacheTTLInSeconds, harvester })
}

module.exports = serviceFactory
