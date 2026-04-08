// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { DequeuedMessage, IQueue, QueueMessage } from './index.js'
import type { Logger } from '../logging/index.js'

export interface MemoryQueueOptions {
  /** Decode message text before JSON.parse. Defaults to identity function. */
  decoder?: (text: string) => string
  logger?: Logger
}

export declare class MemoryQueue implements IQueue {
  options: MemoryQueueOptions
  logger: Logger
  data: QueueMessage[]
  messageId: number
  decoder: (text: string) => string

  constructor(options: MemoryQueueOptions)

  initialize(): Promise<void>
  queue(message: string): Promise<void>
  dequeue(): Promise<DequeuedMessage | null>
  dequeueMultiple(): Promise<DequeuedMessage[]>
  delete(message: DequeuedMessage): Promise<void>
}

/**
 * Factory function to create a MemoryQueue instance.
 *
 * @param opts - Optional configuration (decoder, etc.)
 * @returns A new MemoryQueue
 */
declare function createMemoryQueue(opts?: MemoryQueueOptions): MemoryQueue

export default createMemoryQueue
