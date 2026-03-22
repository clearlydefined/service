// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { DequeuedMessage, IQueue } from '.'
import type { Logger } from '../logging'

export interface AzureStorageQueueOptions {
  /** Azure Storage connection string */
  connectionString: string
  /** Name of the queue */
  queueName: string
  /** Options passed to getMessages() for batch dequeue */
  dequeueOptions?: Record<string, any>
}

export declare class AzureStorageQueue implements IQueue {
  options: AzureStorageQueueOptions
  logger: Logger

  constructor(options: AzureStorageQueueOptions)

  initialize(): Promise<void>
  queue(message: string): Promise<void>
  dequeue(): Promise<DequeuedMessage | null>
  dequeueMultiple(): Promise<DequeuedMessage[]>
  delete(message: DequeuedMessage): Promise<void>
}

export default AzureStorageQueue
export = AzureStorageQueue
