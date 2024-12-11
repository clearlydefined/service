// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { DefinitionVersionChecker } = require('./defVersionCheck')
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
    try {
      const message = this._constructMessage(definition)
      await this._upgrade.queue(message)
      this.logger.debug('Queued for definition upgrade ', {
        coordinates: DefinitionVersionChecker.getCoordinates(definition)
      })
    } catch (error) {
      //continue if queuing fails and requeue at the next request.
      this.logger.error(`Error queuing for definition upgrade ${error.message}`, {
        error,
        coordinates: DefinitionVersionChecker.getCoordinates(definition)
      })
    }
  }

  _constructMessage(definition) {
    const { coordinates, _meta } = definition
    const content = { coordinates, _meta }
    return Buffer.from(JSON.stringify(content)).toString('base64')
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
