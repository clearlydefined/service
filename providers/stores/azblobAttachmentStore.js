// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const { promisify } = require('util')

class AzBlobAttachmentStore {
  constructor(options) {
    this.options = options
    this.containerName = options.containerName
  }

  async initialize() {
    this.blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    return promisify(this.blobService.createContainerIfNotExists)(this.containerName)
  }

  /**
   * Get the attachment object by the given key.
   *
   * @param {string} key - The key that identifies the attachment to get
   * @returns The requested attachment.
   */
  async get(key) {
    try {
      const name = 'attachment/' + key + '.json'
      const result = await promisify(this.blobService.getBlobToText)(this.containerName, name)
      return JSON.parse(result).attachment
    } catch (error) {
      if (error.statusCode === 404) return null
      throw error
    }
  }
}

module.exports = options => new AzBlobAttachmentStore(options)
