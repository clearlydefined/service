// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { MemoryQueue, MemoryQueueOptions } from '../queueing/memoryQueue'

interface RecomputeQueueFactories {
  /**
   * Factory function that creates a MemoryQueue pre-configured with a base64 decoder
   * for definition upgrade processing.
   * Decoded messages are passed through `Buffer.from(text, 'base64').toString('utf8')`
   * before JSON parsing.
   *
   * @param opts - Optional configuration overrides
   * @returns A MemoryQueue instance with base64 decoding enabled
   */
  upgrade(opts?: MemoryQueueOptions): MemoryQueue

  /**
   * Factory function that creates a MemoryQueue pre-configured with a base64 decoder
   * for delayed compute processing.
   *
   * @param opts - Optional configuration overrides
   * @returns A MemoryQueue instance with base64 decoding enabled
   */
  compute(opts?: MemoryQueueOptions): MemoryQueue
}

/**
 * Queue factories for upgrade and delayed compute processing.
 * Both `upgrade` and `compute` create MemoryQueue instances with base64 decode behavior.
 */
declare const queues: RecomputeQueueFactories

export = queues
