// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const { setup } = require('./process')
const { SkipUpgradePolicy } = require('./skipUpgradePolicy')
const Cache = require('../caching/memory')

/** @typedef {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} DefinitionQueueUpgraderOptions */
/** @typedef {import('./delayedComputePolicy').DelayedComputePolicyOptions} DelayedComputePolicyOptions */
/** @typedef {import('../../business/definitionService').DefinitionService} DefinitionService */
/** @typedef {import('../../business/definitionService').Definition} Definition */
/** @typedef {import('../../lib/entityCoordinates')} EntityCoordinates */
/** @typedef {import('../logging').Logger} Logger */

class DelayedComputePolicy {
  static _enqueueCacheTtlSeconds = 60 * 20 /* 20 mins */

  /** @param {DelayedComputePolicyOptions} options */
  constructor(options) {
    this.options = options
    this.logger = options.logger || logger()
    this._enqueueCache =
      options.enqueueCache || Cache({ defaultTtlSeconds: DelayedComputePolicy._enqueueCacheTtlSeconds })
  }

  async initialize() {
    const options = /** @type {DelayedComputePolicyOptions} */ (this.options)
    this._compute = options.queue()
    return this._compute.initialize()
  }

  /**
   * @param {DefinitionService} definitionService
   * @param {Logger} logger
   * @param {boolean} [once]
   */
  setupProcessing(definitionService, logger, once) {
    const upgradePolicy = new SkipUpgradePolicy()
    return setup(this._compute, definitionService, logger, once, upgradePolicy)
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
    const key = coordinates.toString()
    if (this._enqueueCache.get(key)) {
      this.logger.debug('Skipped duplicate enqueue for delayed definition compute', { coordinates: key })
      return
    }
    const message = this._constructMessage(coordinates)
    await this._compute.queue(message)
    this._enqueueCache.set(key, true)
    this.logger.info('Queued for delayed definition compute', {
      coordinates: key
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
