// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { DefinitionVersionChecker } = require('./defVersionCheck')
const { setup } = require('./process')

/**
 * @typedef {import('../../business/definitionService').Definition} Definition
 * @typedef {import('../../business/definitionService').DefinitionService} DefinitionService
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('../caching').ICache} ICache
 */

class DefinitionQueueUpgrader extends DefinitionVersionChecker {
  /**
   * @override
   * @param {Definition | null} definition
   * @returns {Promise<Definition | undefined>}
   */
  async validate(definition) {
    if (!definition) {
      return undefined
    }
    const result = await super.validate(definition)
    if (result) {
      return result
    }

    await this._queueUpgrade(definition)
    return definition
  }

  /** @param {Definition} definition */
  async _queueUpgrade(definition) {
    if (!this._upgrade) {
      throw new Error('Upgrade queue is not set')
    }
    try {
      const message = this._constructMessage(definition)
      await this._upgrade.queue(message)
      this.logger.info('Queued for definition upgrade ', {
        coordinates: DefinitionVersionChecker.getCoordinates(definition)
      })
    } catch (error) {
      //continue if queueing fails and requeue at the next request.
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Error queueing for definition upgrade ${message}`, {
        error,
        coordinates: DefinitionVersionChecker.getCoordinates(definition)
      })
    }
  }

  /**
   * @param {Definition} definition
   * @returns {string}
   */
  _constructMessage(definition) {
    const { coordinates, _meta } = definition
    const content = { coordinates, _meta }
    return Buffer.from(JSON.stringify(content)).toString('base64')
  }

  /** @override */
  async initialize() {
    const options = /** @type {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} */ (this.options)
    this._upgrade = options.queue()
    return this._upgrade.initialize()
  }

  /**
   * @override
   * @param {DefinitionService} definitionService
   * @param {Logger} logger
   * @param {boolean} [once]
   * @param {ICache} [sharedCache]
   */
  setupProcessing(definitionService, logger, once, sharedCache) {
    // Use a plain DefinitionVersionChecker (not `this`) so the queue processor returns undefined
    // for stale definitions and triggers recompute — rather than re-queuing them again.
    return setup(
      this._upgrade,
      definitionService,
      logger,
      once,
      new DefinitionVersionChecker(this.options),
      sharedCache
    )
  }
}

module.exports = DefinitionQueueUpgrader
