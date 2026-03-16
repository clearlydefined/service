// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { factory: versionCheckFactory } = require('./defVersionCheck')
const DefinitionQueueUpgrader = require('./defUpgradeQueue')
const { createOnDemandComputePolicy } = require('./onDemandComputePolicy')
const { createDelayedComputePolicy } = require('./delayedComputePolicy')
const memoryQueueConfig = require('./memoryQueueConfig')
const Cache = require('../caching/memory')
const { DefinitionUpgrader } = require('./process')

/** @typedef {import('../../business/definitionService').DefinitionService} DefinitionService */
/** @typedef {import('../../business/definitionService').Definition} Definition */
/** @typedef {import('../../business/definitionService').UpgradeHandler} UpgradeHandler */
/** @typedef {import('../logging').Logger} Logger */
/** @typedef {import('../queueing').IQueue} IQueue */
/** @typedef {import('../caching').ICache} ICache */
/** @typedef {import('../../lib/entityCoordinates')} EntityCoordinates */
/** @typedef {import('./computePolicy').MissingDefinitionComputePolicy} MissingDefinitionComputePolicy */

/**
 * @typedef {UpgradeHandler & {
 *   initialize?: () => Promise<void> | void,
 *   setupProcessing?: (definitionService?: DefinitionService, logger?: Logger, once?: boolean, cache?: ICache) => Promise<void> | void
 * }} UpgradePolicy
 */

/** @typedef {{ upgradePolicy: UpgradePolicy, computePolicy?: MissingDefinitionComputePolicy }} RecomputeHandlerOptions */

/**
 * @typedef {{
 *   queue?: { upgrade?: () => IQueue, compute?: () => IQueue },
 *   logger?: Logger
 * }} DelayedFactoryOptions
 */

class RecomputeHandler {
  /** @param {RecomputeHandlerOptions} options */
  constructor(options) {
    this._upgradePolicy = options.upgradePolicy
    this._computePolicy = options.computePolicy || createOnDemandComputePolicy()
    this._sharedCache = Cache({
      defaultTtlSeconds: DefinitionUpgrader.defaultTtlSeconds
    })
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
      this._upgradePolicy.setupProcessing?.(definitionService, logger, once, this._sharedCache),
      this._computePolicy.setupProcessing?.(definitionService, logger, once, this._sharedCache)
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
    computePolicy: createDelayedComputePolicy(computeOptions)
  })
}

module.exports = {
  RecomputeHandler,
  defaultFactory,
  delayedFactory
}
