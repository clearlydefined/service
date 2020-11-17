// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage')
const logger = require('../logging/logger')
const { promisify } = require('util')

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

  /**
   * Add a message to the queue. Any encoding/stringifying is up to the caller
   * Max size of message is 64KB
   *
   * @param {string} message
   */
  async queue(message) {
    await promisify(this.queueService.createMessage).bind(this.queueService)(this.options.queueName, message)
  }

  /**
   * Temporarily Lock and return a message from the queue
   * If processing is successful, the caller is expected to call delete()
   * Returns null if the queue is empty
   * If DQ count exceeds 5 the message will be deleted and the next message will be returned
   *
   * @returns {object} - { original: message, data: "JSON parsed, base64 decoded message" }
   */
  async dequeue() {
    const message = await promisify(this.queueService.getMessage).bind(this.queueService)(this.options.queueName)
    if (!message) return null
    if (message.dequeueCount <= 5)
      return { original: message, data: JSON.parse(Buffer.from(message.messageText, 'base64').toString('utf8')) }
    await this.delete({ original: message })
    return this.dequeue()
  }

  /** Similar to dequeue() but returns multiple messages to improve performance */
  async dequeueMultiple() {
    const messages = await promisify(this.queueService.getMessages).bind(this.queueService)(this.options.queueName, this.options.dequeueOptions)
    if (!messages || messages.length === 0) return []
    for (const i in messages) {
      if (messages[i].dequeueCount <= 5) {
        messages[i] = { original: messages[i], data: JSON.parse(Buffer.from(messages[i].messageText, 'base64').toString('utf8')) }
      } else {
        await this.delete({ original: messages[i] })
      }
    }
    return messages
  }

  /**
   * Delete a recently DQ'd message from the queue
   * pass dequeue().original as the message to delete
   *
   * @param {object} message
   */
  async delete(message) {
    await promisify(this.queueService.deleteMessage).bind(this.queueService)(
      this.options.queueName,
      message.original.messageId,
      message.original.popReceipt
    )
  }
}

module.exports = AzureStorageQueue
