// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const crawler = require('./crawler')
const cacheBasedCrawler = require('./cacheBasedCrawler')

const defaultOpts = {
  authToken: config.get('CRAWLER_API_AUTH_TOKEN'),
  url: config.get('CRAWLER_API_URL') || 'http://localhost:5000'
}

function serviceFactory(options) {
  const crawlerOptions = { ...defaultOpts, ...options }
  const harvester = crawler(crawlerOptions)
  return cacheBasedCrawler({ ...options, harvester })
}

module.exports = serviceFactory
