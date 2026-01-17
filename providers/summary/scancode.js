// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./index').SummarizerOptions} SummarizerOptions
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./scancode').ScanCodeHarvestedData} ScanCodeHarvestedData
 * @typedef {import('./scancode').ScanCodeSummaryResult} ScanCodeSummaryResult
 */

const { get } = require('lodash')
const { gte } = require('semver')
const Logger = require('../logging/logger')
const ScanCodeLegacySummarizer = require('./scancode/legacy-summarizer')
const ScanCodeNewSummarizer = require('./scancode/new-summarizer')

/**
 * ScanCode delegator class that routes summarization to the appropriate
 * version-specific summarizer based on the ScanCode version.
 * @class
 */
class ScanCodeDelegator {
  /**
   * Creates a new ScanCodeDelegator instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   * @param {Logger} [logger] - Logger instance for logging
   */
  constructor(options, logger = Logger()) {
    this.options = options
    this.logger = logger
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * Routes to the appropriate version-specific summarizer based on the
   * ScanCode version detected in the harvested data.
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {ScanCodeHarvestedData} harvested - the set of raw tool outputs related to the identified entity
   * @returns {ScanCodeSummaryResult} - a summary of the given raw information
   * @throws {Error} If the ScanCode version is invalid or data is not valid
   */
  summarize(coordinates, harvested) {
    const scancodeVersion = /** @type {string | undefined} */ (
      get(harvested, 'content.headers[0].tool_version') || get(harvested, 'content.scancode_version')
    )
    if (!scancodeVersion) throw new Error('Not valid ScanCode data')

    if (gte(scancodeVersion, '32.1.0')) {
      return ScanCodeNewSummarizer(this.options, this.logger).summarize(scancodeVersion, coordinates, harvested)
    }

    return ScanCodeLegacySummarizer(this.options, this.logger).summarize(scancodeVersion, coordinates, harvested)
  }
}

/**
 * Factory function that creates a ScanCodeDelegator instance
 * @param {SummarizerOptions} [options] - Configuration options for the summarizer
 * @param {Logger} [logger] - Optional logger instance
 * @returns {ScanCodeDelegator} A new ScanCodeDelegator instance
 */
module.exports = (options, logger) => new ScanCodeDelegator(options, logger)
