// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const logger = require('../logging/logger')
const { promisify } = require('util')
const base64 = require('base-64')

class AzureStorageQueue {
  constructor(options) {
    this.options = options
    this.logger = logger()
  }

  async initialize() {
    this.queueService = azure
      .createQueueService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    await promisify(this.queueService.createQueueIfNotExists).bind(this.queueService)(this.options.queueName)
  }

  async dequeue() {
    const message = await promisify(this.queueService.getMessage).bind(this.queueService)(this.options.queueName)
    if (!message) return null
    if (message.dequeueCount <= 5) return { original: message, data: JSON.parse(base64.decode(message.messageText)) }
    await this.delete(message)
    return this.dequeue()
  }

  async delete(message) {
    await promisify(this.queueService.deleteMessage).bind(this.queueService)(
      this.options.queueName,
      message.original.messageId,
      message.original.popReceipt
    )
  }
}

module.exports = AzureStorageQueue
