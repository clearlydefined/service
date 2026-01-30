// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./abstractFileStore').FileStoreOptions} FileStoreOptions
 * @typedef {import('./fileAttachmentStore').FileAttachmentStoreOptions} FileAttachmentStoreOptions
 */

const config = require('painless-config')

const location = config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')

/**
 * Creates a file-based harvest store with the given options or default configuration.
 *
 * @param {FileStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./fileHarvestStore')>} A new FileHarvestStore instance
 */
function harvest(options) {
  return require('./fileHarvestStore')(options || { location })
}

/**
 * Creates a file-based definition store with the given options or default configuration.
 *
 * @param {FileStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./fileDefinitionStore')>} A new FileDefinitionStore instance
 */
function definition(options) {
  return require('./fileDefinitionStore')(options || { location: location + '-definition' })
}

/**
 * Creates a file-based attachment store with the given options or default configuration.
 *
 * @param {FileAttachmentStoreOptions} [options] - Optional configuration options for the store
 * @returns {ReturnType<typeof import('./fileAttachmentStore')>} A new FileAttachmentStore instance
 */
function attachment(options) {
  return require('./fileAttachmentStore')(options || { location: location + '-attachment' })
}

module.exports = { harvest, definition, attachment }
