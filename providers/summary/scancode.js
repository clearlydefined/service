// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const { gte } = require('semver')
const Logger = require('../logging/logger')
const ScanCodeLegacySummarizer = require('./scancode/legacy-summarizer')
const ScanCodeNewSummarizer = require('./scancode/new-summarizer')

class ScanCodeDelegator {
  constructor(options, logger = Logger()) {
    this.options = options
    this.logger = logger
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntitySpec} coordinates - The entity for which we are summarizing
   * @param {*} harvested - the set of raw tool outputs related to the identified entity
   * @returns {Definition} - a summary of the given raw information
   */
  summarize(coordinates, harvested) {
    const scancodeVersion =
      get(harvested, 'content.headers[0].tool_version') || get(harvested, 'content.scancode_version')
    if (!scancodeVersion) throw new Error('Not valid ScanCode data')

    if (gte(scancodeVersion, '32.1.0')) {
      return ScanCodeNewSummarizer(this.options, this.logger).summarize(scancodeVersion, coordinates, harvested)
    }

    return ScanCodeLegacySummarizer(this.options, this.logger).summarize(scancodeVersion, coordinates, harvested)
  }
}

module.exports = (options, logger) => new ScanCodeDelegator(options, logger)
