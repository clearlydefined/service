// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const { setup } = require('./process')
const { SkipUpgradePolicy } = require('./skipUpgradePolicy')

/** @typedef {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} DefinitionQueueUpgraderOptions */
/** @typedef {import('../../business/definitionService').DefinitionService} DefinitionService */
/** @typedef {import('../../business/definitionService').Definition} Definition */
/** @typedef {import('../../lib/entityCoordinates')} EntityCoordinates */
/** @typedef {import('../logging').Logger} Logger */
/** @typedef {import('../caching').ICache} ICache */

class DelayedComputePolicy {
  /** @param {DefinitionQueueUpgraderOptions} options */
  constructor(options) {
    this.options = options
    this.logger = options.logger || logger()
  }

  async initialize() {
    const options = /** @type {DefinitionQueueUpgraderOptions} */ (this.options)
    this._compute = options.queue()
    return this._compute.initialize()
  }

  /**
   * @param {DefinitionService} definitionService
   * @param {Logger} logger
   * @param {boolean} [once]
   * @param {ICache} [cache]
   */
  setupProcessing(definitionService, logger, once, cache) {
    const upgradePolicy = new SkipUpgradePolicy()
    return setup(this._compute, definitionService, logger, once, upgradePolicy, cache)
  }

  /**
   * @param {DefinitionService} definitionService
   * @param {EntityCoordinates} coordinates
   * @returns {Promise<Definition>}
   */
  async compute(definitionService, coordinates) {
    await this._queueCompute(coordinates)
    return definitionService.buildEmptyDefinition(coordinates)
  }

  /** @param {EntityCoordinates} coordinates */
  async _queueCompute(coordinates) {
    if (!this._compute) {
      throw new Error('Compute queue is not set. DelayedComputePolicy.initialize() must be called before compute()')
    }
    const message = this._constructMessage(coordinates)
    await this._compute.queue(message)
    this.logger.info('Queued for delayed definition compute', {
      coordinates: coordinates.toString()
    })
  }

  /**
   * @param {EntityCoordinates} coordinates
   * @returns {string}
   */
  _constructMessage(coordinates) {
    return Buffer.from(JSON.stringify({ coordinates })).toString('base64')
  }
}

module.exports = {
  DelayedComputePolicy
}
