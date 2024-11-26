// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const { lt } = require('semver')
const { DefinitionVersionChecker } = require('./defVersionCheck')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { setup } = require('./process')

class DefinitionQueueUpgrader extends DefinitionVersionChecker {
  async validate(definition) {
    const result = await super.validate(definition)
    if (result) return result

    //otherwise queue for upgrade before returning
    if (!this.upgrade) throw new Error('Upgrade queue is not set')
    const message = JSON.stringify(this._constructMessage(definition))
    await this.upgrade.queue(message)
    return definition
  }

  _constructMessage(definition) {
    const { coordinates, _meta } = definition
    return { coordinates, _meta }
  }

  async initialize() {
    this.upgrade = this.options.queue()
    return this.upgrade.initialize()
  }

  setupProcessing(definitionService, logger) {
    setup(this.upgrade, definitionService, logger)
  }
}

module.exports = DefinitionQueueUpgrader
