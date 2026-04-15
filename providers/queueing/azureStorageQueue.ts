// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { promisify } from 'node:util'
import azure from 'azure-storage'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { DequeuedMessage, IQueue, QueueMessage } from './index.js'

export interface AzureStorageQueueOptions {
  connectionString: string
  queueName: string
  dequeueOptions?: Record<string, any>
}

class AzureStorageQueue implements IQueue {
  options: AzureStorageQueueOptions
  logger: Logger
  declare queueService: ReturnType<typeof azure.createQueueService>

  constructor(options: AzureStorageQueueOptions) {
    this.options = options
    this.logger = logger()
  }

  async initialize(): Promise<void> {
    this.queueService = azure
      .createQueueService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    await promisify(this.queueService.createQueueIfNotExists).bind(this.queueService)(this.options.queueName)
  }

  /**
   * Add a message to the queue. Any encoding/stringifying is up to the caller
   * Max size of message is 64KB
   */
  async queue(message: string): Promise<void> {
    await promisify(this.queueService.createMessage).bind(this.queueService)(this.options.queueName, message)
  }

  /**
   * Temporarily Lock and return a message from the queue
   * If processing is successful, the caller is expected to call delete()
   * Returns null if the queue is empty
   * If DQ count exceeds 5 the message will be deleted and the next message will be returned
   */
  async dequeue(): Promise<DequeuedMessage | null> {
    const message = await promisify(this.queueService.getMessage).bind(this.queueService)(this.options.queueName)
    if (!message) {
      return null
    }
    if (message.dequeueCount <= 5) {
      return {
        original: message as unknown as QueueMessage,
        data: JSON.parse(Buffer.from(message.messageText, 'base64').toString('utf8'))
      }
    }
    await this.delete({ original: message as unknown as QueueMessage })
    return this.dequeue()
  }

  /**
   * Similar to dequeue() but returns multiple messages to improve performance
   */
  async dequeueMultiple(): Promise<DequeuedMessage[]> {
    const boundGetMessages = promisify(this.queueService.getMessages).bind(this.queueService) as (
      queueName: string,
      options?: Record<string, any>
    ) => Promise<QueueMessage[]>
    const messages = await boundGetMessages(this.options.queueName, this.options.dequeueOptions)
    if (!messages || messages.length === 0) {
      return []
    }
    const result: DequeuedMessage[] = []
    for (const msg of messages) {
      if (msg.dequeueCount <= 5) {
        result.push({
          original: msg,
          data: JSON.parse(Buffer.from(msg.messageText!, 'base64').toString('utf8'))
        })
      } else {
        await this.delete({ original: msg })
      }
    }
    return result
  }

  /**
   * Delete a recently DQ'd message from the queue
   * pass dequeue().original as the message to delete
   */
  async delete(message: DequeuedMessage): Promise<void> {
    await promisify(this.queueService.deleteMessage).bind(this.queueService)(
      this.options.queueName,
      String(message.original.messageId),
      message.original.popReceipt
    )
  }
}

export default AzureStorageQueue
