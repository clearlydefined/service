// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { MemoryQueue, MemoryQueueOptions } from '../queueing/memoryQueue'

/**
 * Factory function that creates a MemoryQueue pre-configured with a base64 decoder.
 * Decoded messages are passed through `Buffer.from(text, 'base64').toString('utf8')`
 * before JSON parsing.
 *
 * @param opts - Optional configuration overrides
 * @returns A MemoryQueue instance with base64 decoding enabled
 */
declare function encodedMessageQueueFactory(opts?: MemoryQueueOptions): MemoryQueue

export = encodedMessageQueueFactory
