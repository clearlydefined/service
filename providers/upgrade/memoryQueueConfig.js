// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import MemoryQueue from '../queueing/memoryQueue.ts'

/** @typedef {import('../queueing/memoryQueue').MemoryQueueOptions} MemoryQueueOptions */

/**
 * @param {MemoryQueueOptions} [opts]
 * @returns {import('../queueing/memoryQueue').MemoryQueue}
 */
const encodedMessageQueueFactory = opts => {
  const defaultOpts = {
    decoder: (/** @type {string} */ text) => Buffer.from(text, 'base64').toString('utf8')
  }
  const mergedOpts = { ...defaultOpts, ...opts }
  return MemoryQueue(mergedOpts)
}

export default { upgrade: encodedMessageQueueFactory, compute: encodedMessageQueueFactory }
