// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const DefinitionQueueUpgrader = require('./defUpgradeQueue')
const memory = require('../queueing/memoryQueue')

function serviceFactory(options = {}) {
  const mergedOptions = { queue: memory, ...options }
  return new DefinitionQueueUpgrader(mergedOptions)
}

module.exports = serviceFactory
