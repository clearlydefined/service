// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const ListBasedFilter = require('./listBasedFilter')
const loggerFactory = require('../../logging/logger')

/**
 * @typedef {import('../../logging').Logger} Logger
 */

/**
 * Parses a JSON array string from environment variable
 * @param {string|undefined} value - The string value to parse (expected to be JSON array)
 * @param {Logger} logger - Logger instance for error reporting
 * @returns {string[]} Parsed array or empty array if parsing fails
 */
function parseListEnv(value, logger) {
  if (!value || value.trim() === '') return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) throw new Error('Not an array')
    return parsed
  } catch (e) {
    logger.warn(`Blacklist configuration invalid, using empty list: ${e instanceof Error ? e.message : String(e)}`)
    return []
  }
}

/**
 * Factory function that creates a ListBasedFilter instance from configuration
 * @param {string} [listOpts] - Optional override for the blacklist configuration
 * @returns {ListBasedFilter} A configured ListBasedFilter instance
 */
function throttlerFactory(listOpts) {
  const listEnv = listOpts || config.get('HARVEST_THROTTLER_BLACKLIST')
  const logger = loggerFactory()
  const blacklist = parseListEnv(listEnv, logger)
  return new ListBasedFilter({ blacklist, logger })
}

module.exports = throttlerFactory
