// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RecomputeQueueFactories } from '../index.ts'
import type { MemoryQueueOptions, MemoryQueue as MemoryQueueType } from '../queueing/memoryQueue.ts'
import MemoryQueue from '../queueing/memoryQueue.ts'

const encodedMessageQueueFactory = (opts?: MemoryQueueOptions): MemoryQueueType => {
  const defaultOpts: MemoryQueueOptions = {
    decoder: (text: string) => Buffer.from(text, 'base64').toString('utf8')
  }
  const mergedOpts = { ...defaultOpts, ...opts }
  return MemoryQueue(mergedOpts)
}

const queues: RecomputeQueueFactories<MemoryQueueType> = {
  upgrade: encodedMessageQueueFactory,
  compute: encodedMessageQueueFactory
}
export default queues
