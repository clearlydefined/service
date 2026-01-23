// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { QueueServiceClient } = require('@azure/storage-queue')
const logger = require('../logging/logger')

class AzureStorageQueue {
  constructor(options) {
    this.options = options
    this.logger = logger()
  }

  async initialize() {
    this.queueServiceClient = QueueServiceClient.fromConnectionString(this.options.connectionString)
    this.queueClient = this.queueServiceClient.getQueueClient(this.options.queueName)
    await this.queueClient.createIfNotExists()
  }

  /**
   * Add a message to the queue. Any encoding/stringifying is up to the caller
   * Max size of message is 64KB
   *
   * @param {string} message
   */
  async queue(message) {
    await this.queueClient.sendMessage(message)
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
    const response = await this.queueClient.receiveMessages({ numberOfMessages: 1 })
    if (!response.receivedMessageItems || response.receivedMessageItems.length === 0) return null

    const message = response.receivedMessageItems[0]
    if (message.dequeueCount <= 5) {
      return {
        original: message,
        data: JSON.parse(Buffer.from(message.messageText, 'base64').toString('utf8'))
      }
    }
    await this.delete({ original: message })
    return this.dequeue()
  }

  /** Similar to dequeue() but returns multiple messages to improve performance */
  async dequeueMultiple() {
    const options = this.options.dequeueOptions || {}
    const response = await this.queueClient.receiveMessages({
      numberOfMessages: options.numOfMessages || 32,
      visibilityTimeout: options.visibilityTimeout
    })

    if (!response.receivedMessageItems || response.receivedMessageItems.length === 0) return []

    const results = []
    for (const message of response.receivedMessageItems) {
      if (message.dequeueCount <= 5) {
        results.push({
          original: message,
          data: JSON.parse(Buffer.from(message.messageText, 'base64').toString('utf8'))
        })
      } else {
        await this.delete({ original: message })
      }
    }
    return results
  }

  /**
   * Delete a recently DQ'd message from the queue
   * pass dequeue().original as the message to delete
   *
   * @param {object} message
   */
  async delete(message) {
    await this.queueClient.deleteMessage(message.original.messageId, message.original.popReceipt)
  }
}

module.exports = AzureStorageQueue
