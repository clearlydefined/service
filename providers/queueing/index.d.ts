// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** A message sitting in the queue (not yet dequeued) */
export interface QueueMessage {
  messageText?: string
  messageId: string | number
  dequeueCount: number
  popReceipt?: string
}

/** Wrapper returned by dequeue(), pairing the raw queue message with parsed data */
export interface DequeuedMessage<T = any> {
  original: QueueMessage
  data?: T
}

/** Common interface for all queue implementations */
export interface IQueue<T = any> {
  initialize(): Promise<void>

  /** Add a message to the queue. Encoding/stringifying is the caller's responsibility. */
  queue(message: string): Promise<void>

  /**
   * Lock and return a single message. Returns null if the queue is empty.
   * Messages dequeued more than 5 times are automatically deleted.
   */
  dequeue(): Promise<DequeuedMessage<T> | null>

  /** Like dequeue() but returns an array (possibly empty). */
  dequeueMultiple(): Promise<DequeuedMessage<T>[]>

  /** Delete a previously dequeued message. Pass the object returned by dequeue(). */
  delete(message: DequeuedMessage<T>): Promise<void>
}
