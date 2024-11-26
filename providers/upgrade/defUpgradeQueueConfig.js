// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const DefinitionQueueUpgrader = require('./defUpgradeQueue')
const memory = require('./memoryQueueConfig')

function serviceFactory(options) {
  const realOptions = { queue: memory, ...options }
  return new DefinitionQueueUpgrader(realOptions)
}

module.exports = serviceFactory
