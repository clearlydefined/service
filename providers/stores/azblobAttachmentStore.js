// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('./azblobAttachmentStore').AzBlobAttachmentStoreOptions} AzBlobAttachmentStoreOptions
 */

const azure = require('azure-storage')
const { promisify } = require('util')
const Bottleneck = require('bottleneck').default
const limiter = new Bottleneck({ maxConcurrent: 1000 })
const logger = require('../logging/logger')

/**
 * Azure Blob Storage implementation for storing and retrieving attachments.
 * Uses rate limiting to control concurrent access.
 */
class AzBlobAttachmentStore {
  /**
   * Creates a new AzBlobAttachmentStore instance.
   *
   * @param {AzBlobAttachmentStoreOptions} options - Configuration options for the store
   */
  constructor(options) {
    /** @type {AzBlobAttachmentStoreOptions} */
    this.options = options
    /** @type {string} */
    this.containerName = options.containerName
    /** @type {Logger} */
    this.logger = logger()
  }

  /**
   * Initializes the blob service and creates the container if needed.
   *
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async initialize() {
    this.blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    return promisify(this.blobService.createContainerIfNotExists).bind(this.blobService)(this.containerName)
  }

  /**
   * Get the attachment object by the given key.
   *
   * @param {string} key - The key that identifies the attachment to get
   * @returns {Promise<any | null>} The requested attachment or null if not found
   */
  get(key) {
    return limiter.wrap(async () => {
      try {
        const name = 'attachment/' + key + '.json'
        this.logger.info('2:1:1:notice_generate:get_single_file:start', { ts: new Date().toISOString(), file: key })
        const result = await promisify(this.blobService.getBlobToText).bind(this.blobService)(this.containerName, name)
        this.logger.info('2:1:1:notice_generate:get_single_file:end', { ts: new Date().toISOString(), file: key })
        return JSON.parse(result).attachment
      } catch (/** @type {any} */ error) {
        if (error.statusCode === 404) return null
        throw error
      }
    })()
  }
}

/**
 * Factory function to create an AzBlobAttachmentStore instance.
 *
 * @param {AzBlobAttachmentStoreOptions} options - Configuration options for the store
 * @returns {AzBlobAttachmentStore} A new AzBlobAttachmentStore instance
 */
module.exports = options => new AzBlobAttachmentStore(options)
