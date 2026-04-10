// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { DequeuedMessage, IQueue, QueueMessage } from './index.js'

export interface MemoryQueueOptions {
  decoder?: (text: string) => string
  logger?: Logger
}

class MemoryQueue implements IQueue {
  declare options: MemoryQueueOptions
  declare logger: Logger
  declare decoder: ((text: string) => string) | undefined
  data: QueueMessage[]
  messageId: number

  constructor(options: MemoryQueueOptions) {
    this.options = options
    this.logger = this.options.logger || logger()
    this.data = []
    this.messageId = 0
    this.decoder = options.decoder
  }

  async initialize(): Promise<void> {}

  /**
   * Add a message to the queue. Any encoding/stringifying is up to the caller
   */
  async queue(message: string): Promise<void> {
    this.data.push({
      messageText: message,
      dequeueCount: 0,
      messageId: ++this.messageId
    })
  }

  /**
   * Return the top message from the queue
   * If processing is successful, the caller is expected to call delete()
   * Returns null if the queue is empty
   */
  async dequeue(): Promise<DequeuedMessage | null> {
    const message = this.data[0]
    if (!message) {
      return null
    }
    this.data[0].dequeueCount++
    if (message.dequeueCount <= 5) {
      return Promise.resolve({
        original: message,
        data: this._parseData(message)
      })
    }
    await this.delete({ original: message })
    return this.dequeue()
  }

  _parseData({ messageText }: QueueMessage) {
    return JSON.parse(this.decoder(messageText))
  }

  /** Similar to dequeue() but returns an array instead. See AzureStorageQueue.dequeueMultiple() */
  async dequeueMultiple(): Promise<DequeuedMessage[]> {
    const message = await this.dequeue()
    return message ? [message] : []
  }

  /**
   * Delete a recently DQ'd message from the queue
   * pass dequeue() result as the message to delete
   */
  async delete(message: DequeuedMessage): Promise<void> {
    const newData = []
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].messageId !== message.original.messageId) {
        newData.push(this.data[i])
      }
    }
    this.data = newData
  }
}

const factory = (opts: MemoryQueueOptions = {}) => {
  const defaultOpts = {
    decoder: (text: string) => text
  }
  const mergedOpts = { ...defaultOpts, ...opts }
  return new MemoryQueue(mergedOpts)
}

export default factory
