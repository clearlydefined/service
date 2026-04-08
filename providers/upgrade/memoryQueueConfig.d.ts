// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RecomputeQueueFactories } from '...js'
import type { MemoryQueue } from '../queueing/memoryQueue.js'

/**
 * Queue factories for upgrade and delayed compute processing.
 * Both `upgrade` and `compute` create MemoryQueue instances with base64 decode behavior.
 */
declare const queues: RecomputeQueueFactories<MemoryQueue>

export default queues
