// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Summary providers module.
 * Exports factory functions for all available summarizer implementations.
 * @type {import('./index').SummaryProviders}
 */
module.exports = {
  reuse: require('./reuse'),
  licensee: require('./licensee'),
  scancode: require('./scancode'),
  fossology: require('./fossology'),
  clearlydefined: require('./clearlydefined'),
  cdsource: require('./cdsource')
}
