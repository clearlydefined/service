// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { promisify } from 'node:util'
import azure from 'azure-storage'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { DequeuedMessage, IQueue } from './index.js'

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
      // @ts-expect-error - azure-storage QueueMessageResult is structurally compatible at runtime
      return { original: message, data: JSON.parse(Buffer.from(message.messageText, 'base64').toString('utf8')) }
    }
    // @ts-expect-error - azure-storage QueueMessageResult used as QueueMessage
    await this.delete({ original: message })
    return this.dequeue()
  }

  /**
   * Similar to dequeue() but returns multiple messages to improve performance
   */
  async dequeueMultiple(): Promise<DequeuedMessage[]> {
    const messages = await promisify(this.queueService.getMessages).bind(this.queueService)(
      this.options.queueName,
      // @ts-expect-error - azure-storage getMessages accepts options as second arg
      this.options.dequeueOptions
    )
    if (!messages || messages.length === 0) {
      return []
    }
    for (const i in messages) {
      if (messages[i].dequeueCount <= 5) {
        messages[i] = {
          // @ts-expect-error
          original: messages[i],
          data: JSON.parse(Buffer.from(messages[i].messageText, 'base64').toString('utf8'))
        }
      } else {
        // @ts-expect-error - azure-storage QueueMessageResult used as QueueMessage
        await this.delete({ original: messages[i] })
      }
    }
    // @ts-expect-error - array has been mutated to DequeuedMessage[]
    return messages
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
