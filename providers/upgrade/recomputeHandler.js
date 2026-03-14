// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { factory: versionCheckFactory } = require('./defVersionCheck')
const DefinitionQueueUpgrader = require('./defUpgradeQueue')

class RecomputeHandler {
  /**
   * @param {{
   *   upgradePolicy: import('../../business/definitionService').UpgradeHandler & {
   *     initialize?: () => Promise<void> | void,
   *     setupProcessing?: (
   *       definitionService?: import('../../business/definitionService').DefinitionService,
   *       logger?: import('../logging').Logger,
   *       once?: boolean
   *     ) => Promise<void> | void
   *   },
   *   computePolicy?: {
   *     initialize?: () => Promise<void> | void,
   *     setupProcessing?: (
   *       definitionService?: import('../../business/definitionService').DefinitionService,
   *       logger?: import('../logging').Logger,
   *       once?: boolean
   *     ) => Promise<void> | void,
   *     compute?: (
   *       definitionService: import('../../business/definitionService').DefinitionService,
   *       coordinates: import('../../lib/entityCoordinates')
   *     ) => Promise<import('../../business/definitionService').Definition | undefined>
   *   }
   * }} options
   */
  constructor(options) {
    this._upgradePolicy = options.upgradePolicy
    this._computePolicy = options.computePolicy || createOnDemandComputePolicy()
  }

  /** @param {string} schemaVersion */
  set currentSchema(schemaVersion) {
    this._upgradePolicy.currentSchema = schemaVersion
  }

  /** @returns {string | undefined} */
  get currentSchema() {
    return this._upgradePolicy.currentSchema
  }

  /** @param {import('../../business/definitionService').Definition | null} definition */
  async validate(definition) {
    return this._upgradePolicy.validate(definition)
  }

  async initialize() {
    if (this._upgradePolicy.initialize) await this._upgradePolicy.initialize()
    if (this._computePolicy.initialize) await this._computePolicy.initialize()
  }

  /**
   * @param {import('../../business/definitionService').DefinitionService} [definitionService]
   * @param {import('../logging').Logger} [logger]
   * @param {boolean} [once]
   */
  setupProcessing(definitionService, logger, once) {
    if (this._upgradePolicy.setupProcessing) this._upgradePolicy.setupProcessing(definitionService, logger, once)
    if (this._computePolicy.setupProcessing) this._computePolicy.setupProcessing(definitionService, logger, once)
  }

  /**
   * @param {import('../../business/definitionService').DefinitionService} definitionService
   * @param {import('../../lib/entityCoordinates')} coordinates
   */
  async compute(definitionService, coordinates) {
    return this._computePolicy.compute(definitionService, coordinates)
  }
}

/**
 * Default compute policy used by recompute handlers.
 * @returns {{
 *   initialize: () => Promise<void>,
 *   setupProcessing: () => void,
 *   compute: (
 *     definitionService: import('../../business/definitionService').DefinitionService,
 *     coordinates: import('../../lib/entityCoordinates')
 *   ) => Promise<import('../../business/definitionService').Definition | undefined>
 * }}
 */
function createOnDemandComputePolicy() {
  return {
    async initialize() {},
    setupProcessing() {},
    async compute(definitionService, coordinates) {
      return definitionService.computeStoreAndCurate(coordinates)
    }
  }
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=versionCheck.
 * @param {import('./defVersionCheck').DefinitionVersionCheckerOptions} [options]
 */
function defaultFactory(options = {}) {
  return new RecomputeHandler({ upgradePolicy: versionCheckFactory(options) })
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=upgradeQueue.
 * @param {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} [options]
 */
function delayedFactory(
  options = /** @type {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} */ ({ queue: () => ({}) })
) {
  return new RecomputeHandler({ upgradePolicy: new DefinitionQueueUpgrader(options) })
}

module.exports = {
  RecomputeHandler,
  createOnDemandComputePolicy,
  defaultFactory,
  delayedFactory
}
