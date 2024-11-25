// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const DefinitionQueueUpgrader = require('./defUpgradeQueue')
const azure = require('./azureQueueConfig')

function serviceFactory(options) {
  const realOptions = options || {
    upgrade: azure()
  }
  realOptions.upgrade.initialize()
  return new DefinitionQueueUpgrader(realOptions)
}

module.exports = serviceFactory
