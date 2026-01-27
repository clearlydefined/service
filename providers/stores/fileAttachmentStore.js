// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('./fileAttachmentStore').FileAttachmentStoreOptions} FileAttachmentStoreOptions
 */

const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const logger = require('../logging/logger')

/**
 * File system implementation for storing and retrieving attachments.
 */
class FileAttachmentStore {
  /**
   * Creates a new FileAttachmentStore instance.
   *
   * @param {FileAttachmentStoreOptions} options - Configuration options for the store
   */
  constructor(options) {
    /** @type {Logger} */
    this.logger = logger()
    /** @type {FileAttachmentStoreOptions} */
    this.options = options
  }

  /**
   * Initializes the store (no-op for file stores).
   *
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async initialize() {}

  /**
   * Get the attachment object by the given key.
   *
   * @param {string} key - The key that identifies the attachment to get
   * @returns {Promise<any | null>} The requested attachment or null if not found
   */
  async get(key) {
    try {
      const filePath = path.join(this.options.location, key + '.json')
      const result = await promisify(fs.readFile)(filePath)
      return JSON.parse(result.toString()).attachment
    } catch (/** @type {any} */ error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }
}

/**
 * Factory function to create a FileAttachmentStore instance.
 *
 * @param {FileAttachmentStoreOptions} options - Configuration options for the store
 * @returns {FileAttachmentStore} A new FileAttachmentStore instance
 */
module.exports = options => new FileAttachmentStore(options)
