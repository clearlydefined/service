// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')

class MemoryQueue {
  constructor(options) {
    this.options = options
    this.logger = logger()
    this.data = []
    this.messageId = 0
  }

  async initialize() {}

  /**
   * Add a message to the queue. Any encoding/stringifying is up to the caller
   *
   * @param {string} message
   */
  async queue(message) {
    this.data.push({ messageText: message, dequeueCount: 0, messageId: ++this.messageId })
  }

  /**
   * Return the top message from the queue
   * If processing is successful, the caller is expected to call delete()
   * Returns null if the queue is empty
   *
   * @returns {object} - { original: message, data: "JSON parsed, base64 decoded message" }
   */
  async dequeue() {
    const message = this.data[0]
    if (!message) return null
    this.data[0].dequeueCount++
    if (message.dequeueCount <= 5) return Promise.resolve({ original: message, data: JSON.parse(message.messageText) })
    await this.delete({ original: message })
    return this.dequeue()
  }

  /** Similar to dequeue() but returns an array instead. See AzureStorageQueue.dequeueMultiple() */
  async dequeueMultiple() {
    return [await this.dequeue()]
  }

  /**
   * Delete a recently DQ'd message from the queue
   * pass dequeue() result as the message to delete
   *
   * @param {object} message
   */
  async delete(message) {
    const newData = []
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].messageId !== message.original.messageId) newData.push(this.data[i])
    }
    this.data = newData
  }
}

module.exports = () => new MemoryQueue()
