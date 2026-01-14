// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const ListBasedFilter = require('./listBasedFilter')
const loggerFactory = require('../../logging/logger')

function parseListEnv(value, logger) {
  if (!value || value.trim() === '') return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) throw new Error('Not an array')
    return parsed
  } catch (e) {
    logger.error(`Blacklist is not valid JSON array; ignoring, ${e.message}`)
  }
}

function throttlerFactory(listOpts) {
  const listEnv = listOpts || config.get('HARVEST_THROTTLER_BLACKLIST')
  const logger = loggerFactory()
  const blacklist = parseListEnv(listEnv, logger)
  return new ListBasedFilter({ blacklist, logger })
}

module.exports = throttlerFactory
