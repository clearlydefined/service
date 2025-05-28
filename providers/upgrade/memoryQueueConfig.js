// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MemoryQueue = require('../queueing/memoryQueue')

const encodedMessageQueueFactory = opts => {
  const defaultOpts = {
    decoder: text => Buffer.from(text, 'base64').toString('utf8')
  }
  const mergedOpts = { ...defaultOpts, ...opts }
  return MemoryQueue(mergedOpts)
}

module.exports = encodedMessageQueueFactory
