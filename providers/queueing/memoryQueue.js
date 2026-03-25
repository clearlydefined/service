// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')

/** @typedef {import('.').QueueMessage} QueueMessage */
/** @typedef {import('.').DequeuedMessage} DequeuedMessage */

class MemoryQueue {
  /**
   * @param {import('./memoryQueue').MemoryQueueOptions} options
   */
  constructor(options) {
    this.options = options
    this.logger = logger()
    /** @type {QueueMessage[]} */
    this.data = []
    this.messageId = 0
    this.decoder = options.decoder
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
   * @returns {Promise<DequeuedMessage | null>}
   */
  async dequeue() {
    const message = this.data[0]
    if (!message) return null
    this.data[0].dequeueCount++
    if (message.dequeueCount <= 5) return Promise.resolve({ original: message, data: this._parseData(message) })
    await this.delete({ original: message })
    return this.dequeue()
  }

  /**
   * @param {QueueMessage} message
   */
  _parseData({ messageText }) {
    return JSON.parse(this.decoder(messageText))
  }

  /** Similar to dequeue() but returns an array instead. See AzureStorageQueue.dequeueMultiple() */
  async dequeueMultiple() {
    const message = await this.dequeue()
    return message ? [message] : []
  }

  /**
   * Delete a recently DQ'd message from the queue
   * pass dequeue() result as the message to delete
   *
   * @param {DequeuedMessage} message
   */
  async delete(message) {
    const newData = []
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].messageId !== message.original.messageId) newData.push(this.data[i])
    }
    this.data = newData
  }
}

const factory = (opts = {}) => {
  const defaultOpts = {
    decoder: /** @param {string} text */ text => text
  }
  const mergedOpts = { ...defaultOpts, ...opts }
  return new MemoryQueue(mergedOpts)
}

module.exports = factory
