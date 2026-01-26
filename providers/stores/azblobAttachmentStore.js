// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { BlobServiceClient } = require('@azure/storage-blob')
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
    this.blobServiceClient = BlobServiceClient.fromConnectionString(this.options.connectionString)
    this.containerClient = this.blobServiceClient.getContainerClient(this.containerName)
    await this.containerClient.createIfNotExists()
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
        const blobClient = this.containerClient.getBlobClient(name)
        const downloadResponse = await blobClient.download()
        const content = await this._streamToString(downloadResponse.readableStreamBody)
        this.logger.info('2:1:1:notice_generate:get_single_file:end', { ts: new Date().toISOString(), file: key })
        return JSON.parse(content).attachment
      } catch (error) {
        if (error.statusCode === 404) return null
        throw error
      }
    })()
  }

  /**
   * Helper to convert a readable stream to a string
   *
   * @private
   * @param {NodeJS.ReadableStream} readableStream - The stream to convert
   * @returns {Promise<string>} The string content
   */
  async _streamToString(readableStream) {
    /** @type {Buffer[]} */
    const chunks = []
    for await (const chunk of readableStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString('utf8')
  }
}

module.exports = options => new AzBlobAttachmentStore(options)
