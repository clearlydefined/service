// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { factory: versionCheckFactory } = require('./defVersionCheck')
const DefinitionQueueUpgrader = require('./defUpgradeQueue')
const { OnDemandComputePolicy } = require('./onDemandComputePolicy')
const { DelayedComputePolicy } = require('./delayedComputePolicy')
const memoryQueueConfig = require('./memoryQueueConfig')
const logger = require('../logging/logger')

/** @typedef {import('../../business/definitionService').DefinitionService} DefinitionService */
/** @typedef {import('../../business/definitionService').Definition} Definition */
/** @typedef {import('../logging').Logger} Logger */
/** @typedef {import('../../lib/entityCoordinates')} EntityCoordinates */
/** @typedef {import('./computePolicy').MissingDefinitionComputePolicy} MissingDefinitionComputePolicy */
/** @typedef {import('./recomputeHandler').UpgradePolicy} UpgradePolicy */

/** @typedef {{ upgradePolicy: UpgradePolicy, computePolicy: MissingDefinitionComputePolicy, logger?: Logger }} RecomputeHandlerOptions */

/** @typedef {import('./recomputeHandler').DelayedFactoryOptions} DelayedFactoryOptions */

class RecomputeHandler {
  /** @param {RecomputeHandlerOptions} options */
  constructor(options) {
    this._upgradePolicy = options.upgradePolicy
    this._computePolicy = options.computePolicy
    this._logger = options.logger || logger()
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
    this._logger.debug('Initializing recompute handler policies', {
      upgradePolicy: getPolicyName(this._upgradePolicy),
      computePolicy: getPolicyName(this._computePolicy)
    })
    await Promise.all([this._upgradePolicy.initialize?.(), this._computePolicy.initialize?.()])
    this._logger.debug('Initialized recompute handler policies', {
      upgradePolicy: getPolicyName(this._upgradePolicy),
      computePolicy: getPolicyName(this._computePolicy)
    })
  }

  /**
   * @param {DefinitionService} [definitionService]
   * @param {Logger} [logger]
   * @param {boolean} [once]
   */
  async setupProcessing(definitionService, logger, once) {
    // Resolves after the first polling batch from each queue. Queue consumers
    // continue running indefinitely in the background via setTimeout — "setup
    // complete" means "first batch processed and polling loop started", not
    // "all processing done".
    this._logger.debug('Setting up recompute handler processing', {
      once: !!once,
      upgradePolicy: getPolicyName(this._upgradePolicy),
      computePolicy: getPolicyName(this._computePolicy)
    })
    await Promise.all([
      this._upgradePolicy.setupProcessing?.(definitionService, logger, once),
      this._computePolicy.setupProcessing?.(definitionService, logger, once)
    ])
    this._logger.debug('Recompute handler processing setup complete', {
      once: !!once,
      upgradePolicy: getPolicyName(this._upgradePolicy),
      computePolicy: getPolicyName(this._computePolicy)
    })
  }

  /**
   * @param {DefinitionService} definitionService
   * @param {EntityCoordinates} coordinates
   */
  async compute(definitionService, coordinates) {
    return this._computePolicy.compute(definitionService, coordinates)
  }
}

/** @param {unknown} policy */
function getPolicyName(policy) {
  return policy?.constructor ? policy.constructor.name : 'UnknownPolicy'
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=versionCheck.
 * Only `logger` is used from options; any other properties (e.g. `queue`) are intentionally ignored.
 * @param {{ logger?: import('../logging').Logger }} [options]
 */
function defaultFactory({ logger } = {}) {
  return new RecomputeHandler({
    upgradePolicy: versionCheckFactory({ logger }),
    computePolicy: new OnDemandComputePolicy(),
    logger
  })
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=upgradeQueue.
 * @param {DelayedFactoryOptions} [options]
 */
function delayedFactory(options = {}) {
  const shared = {
    logger: options.logger
  }
  const upgradeOptions = {
    ...shared,
    queue: options.queue?.upgrade || memoryQueueConfig.upgrade
  }
  const computeOptions = {
    ...shared,
    queue: options.queue?.compute || memoryQueueConfig.compute
  }

  return new RecomputeHandler({
    upgradePolicy: new DefinitionQueueUpgrader(upgradeOptions),
    computePolicy: new DelayedComputePolicy(computeOptions),
    logger: options.logger
  })
}

module.exports = {
  RecomputeHandler,
  defaultFactory,
  delayedFactory
}
