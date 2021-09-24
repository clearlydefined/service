// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const { promisify } = require('util')
const Bottleneck = require('bottleneck').default
const limiter = new Bottleneck({ maxConcurrent: 1000 })
const logger = require('../logging/logger')

class AzBlobAttachmentStore {
  constructor(options) {
    this.options = options
    this.containerName = options.containerName
    this.logger = logger()
  }

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
   * @returns The requested attachment.
   */
  get(key) {
    return limiter.wrap(async () => {
      try {
        const name = 'attachment/' + key + '.json'
        this.logger.info('2:1:1:notice_generate:get_single_file:start', { ts: new Date().toISOString(), file: key })
        const result = await promisify(this.blobService.getBlobToText).bind(this.blobService)(this.containerName, name)
        this.logger.info('2:1:1:notice_generate:get_single_file:end', { ts: new Date().toISOString(), file: key })
        return JSON.parse(result).attachment
      } catch (error) {
        if (error.statusCode === 404) return null
        throw error
      }
    })()
  }
}

module.exports = options => new AzBlobAttachmentStore(options)
