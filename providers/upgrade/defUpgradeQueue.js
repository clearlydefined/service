// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { DefinitionVersionChecker } = require('./defVersionCheck')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { setup } = require('./process')

class DefinitionQueueUpgrader extends DefinitionVersionChecker {
  async validate(definition) {
    if (!definition) return
    const result = await super.validate(definition)
    if (result) return result

    await this._queueUpgrade(definition)
    return definition
  }

  async _queueUpgrade(definition) {
    if (!this._upgrade) throw new Error('Upgrade queue is not set')
    const message = this._constructMessage(definition)
    await this._upgrade.queue(JSON.stringify(message))
    this.logger.debug('Queued for definition upgrade ', {
      coordinates: EntityCoordinates.fromObject(definition.coordinates).toString()
    })
  }

  _constructMessage(definition) {
    const { coordinates, _meta } = definition
    return { coordinates, _meta }
  }

  async initialize() {
    this._upgrade = this.options.queue()
    return this._upgrade.initialize()
  }

  setupProcessing(definitionService, logger, once) {
    return setup(this._upgrade, definitionService, logger, once)
  }
}

module.exports = DefinitionQueueUpgrader
