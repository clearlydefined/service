// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import cdsource from './cdsource.js'
import clearlydefined from './clearlydefined.js'
import fossology from './fossology.js'
import licensee from './licensee.js'
import reuse from './reuse.js'
import scancode from './scancode.js'

/**
 * Summary providers module.
 * Exports factory functions for all available summarizer implementations.
 * @type {import('./index').SummaryProviders}
 */
export default {
  reuse,
  licensee,
  scancode,
  fossology,
  clearlydefined,
  cdsource
}
