// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const { setup } = require('./process')

/** @typedef {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} DefinitionQueueUpgraderOptions */
/** @typedef {import('../../business/definitionService').DefinitionService} DefinitionService */
/** @typedef {import('../../business/definitionService').Definition} Definition */
/** @typedef {import('../../lib/entityCoordinates')} EntityCoordinates */
/** @typedef {import('../logging').Logger} Logger */

class DelayedComputePolicy {
  /** @param {DefinitionQueueUpgraderOptions} [options] */
  constructor(options = /** @type {DefinitionQueueUpgraderOptions} */ ({ queue: () => ({}) })) {
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
   */
  setupProcessing(definitionService, logger, once) {
    return setup(this._compute, definitionService, logger, once)
  }

  /**
   * @param {DefinitionService} definitionService
   * @param {EntityCoordinates} coordinates
   * @returns {Promise<Definition>}
   */
  async compute(definitionService, coordinates) {
    const placeholder = definitionService.buildEmptyDefinition(coordinates)
    await this._queueCompute(coordinates)
    return placeholder
  }

  /** @param {EntityCoordinates} coordinates */
  async _queueCompute(coordinates) {
    if (!this._compute) throw new Error('Compute queue is not set')
    try {
      const message = this._constructMessage(coordinates)
      await this._compute.queue(message)
      this.logger.info('Queued for delayed definition compute', { coordinates: coordinates.toString() })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Error queueing for delayed definition compute ${message}`, {
        error,
        coordinates: coordinates.toString()
      })
    }
  }

  /**
   * @param {EntityCoordinates} coordinates
   * @returns {string}
   */
  _constructMessage(coordinates) {
    const _meta = {}
    const content = { coordinates, _meta }
    return Buffer.from(JSON.stringify(content)).toString('base64')
  }
}

/**
 * @param {DefinitionQueueUpgraderOptions} [options]
 * @returns {DelayedComputePolicy}
 */
function createDelayedComputePolicy(options = /** @type {DefinitionQueueUpgraderOptions} */ ({ queue: () => ({}) })) {
  return new DelayedComputePolicy(options)
}

module.exports = {
  DelayedComputePolicy,
  createDelayedComputePolicy
}
