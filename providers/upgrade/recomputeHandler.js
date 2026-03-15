// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { factory: versionCheckFactory } = require('./defVersionCheck')
const DefinitionQueueUpgrader = require('./defUpgradeQueue')
const { createOnDemandComputePolicy } = require('./onDemandComputePolicy')
const { createDelayedComputePolicy } = require('./queueComputePolicy')

/** @typedef {import('../../business/definitionService').DefinitionService} DefinitionService */
/** @typedef {import('../../business/definitionService').Definition} Definition */
/** @typedef {import('../../business/definitionService').UpgradeHandler} UpgradeHandler */
/** @typedef {import('../logging').Logger} Logger */
/** @typedef {import('../../lib/entityCoordinates')} EntityCoordinates */
/** @typedef {import('./computePolicy').MissingDefinitionComputePolicy} MissingDefinitionComputePolicy */

/**
 * @typedef {UpgradeHandler & {
 *   initialize?: () => Promise<void> | void,
 *   setupProcessing?: (definitionService?: DefinitionService, logger?: Logger, once?: boolean) => Promise<void> | void
 * }} UpgradePolicy
 */

/** @typedef {{ upgradePolicy: UpgradePolicy, computePolicy?: MissingDefinitionComputePolicy }} RecomputeHandlerOptions */

class RecomputeHandler {
  /** @param {RecomputeHandlerOptions} options */
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

  /** @param {Definition | null} definition */
  async validate(definition) {
    return this._upgradePolicy.validate(definition)
  }

  async initialize() {
    await Promise.all([this._upgradePolicy.initialize?.(), this._computePolicy.initialize?.()])
  }

  /**
   * @param {DefinitionService} [definitionService]
   * @param {Logger} [logger]
   * @param {boolean} [once]
   */
  async setupProcessing(definitionService, logger, once) {
    await Promise.all([
      this._upgradePolicy.setupProcessing?.(definitionService, logger, once),
      this._computePolicy.setupProcessing?.(definitionService, logger, once)
    ])
  }

  /**
   * @param {DefinitionService} definitionService
   * @param {EntityCoordinates} coordinates
   */
  async compute(definitionService, coordinates) {
    return this._computePolicy.compute(definitionService, coordinates)
  }
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=versionCheck.
 * @param {import('./defVersionCheck').DefinitionVersionCheckerOptions} [options]
 */
function defaultFactory(options = {}) {
  return new RecomputeHandler({
    upgradePolicy: versionCheckFactory(options),
    computePolicy: createOnDemandComputePolicy()
  })
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=upgradeQueue.
 * @param {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} [options]
 */
function delayedFactory(
  options = /** @type {import('./defUpgradeQueue').DefinitionQueueUpgraderOptions} */ ({ queue: () => ({}) })
) {
  return new RecomputeHandler({
    upgradePolicy: new DefinitionQueueUpgrader(options),
    computePolicy: createDelayedComputePolicy(options)
  })
}

module.exports = {
  RecomputeHandler,
  defaultFactory,
  delayedFactory
}
