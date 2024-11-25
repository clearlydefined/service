// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const { lt } = require('semver')
const { DefinitionVersionChecker } = require('./defVersionCheck')
const EntityCoordinates = require('../../lib/entityCoordinates')
const azure = require('./azureQueueConfig')

class DefinitionQueueUpgrader extends DefinitionVersionChecker {
  constructor(options) {
    super(options)
    this.upgrade = options.upgrade
  }

  async validate(definition) {
    const result = await super.validate(definition)
    if (result) return result

    //otherwise queue for upgrade before returning
    const message = JSON.stringify(this._constructMessage(definition))
    await this.upgrade.queue(message)
    return definition
  }

  _constructMessage(definition) {
    const { coordinates, _meta } = definition
    return { coordinates, _meta }
  }
}

module.exports = DefinitionQueueUpgrader
