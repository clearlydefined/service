// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type {
  Definition,
  DefinitionService,
  RecomputeHandler as IRecomputeHandler,
  RecomputeContext,
  UpgradeHandler
} from '../../business/definitionService.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { IQueue } from '../queueing/index.js'
import type { MissingDefinitionComputePolicy } from './computePolicy.js'
import DefinitionQueueUpgrader from './defUpgradeQueue.ts'
import type { DefinitionVersionCheckerOptions } from './defVersionCheck.ts'
import { factory as versionCheckFactory } from './defVersionCheck.ts'
import { DelayedComputePolicy } from './delayedComputePolicy.ts'
import memoryQueueConfig from './memoryQueueConfig.ts'
import { OnDemandComputePolicy } from './onDemandComputePolicy.ts'

/** Upgrade policy accepted by RecomputeHandler: an UpgradeHandler with optional lifecycle hooks */
export interface UpgradePolicy extends UpgradeHandler {
  initialize?(): Promise<void> | void
  setupProcessing?(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void> | void
}

export interface DelayedFactoryOptions {
  queue?: {
    upgrade?: () => IQueue
    compute?: () => IQueue
  }
  logger?: Logger
}

interface RecomputeHandlerOptions {
  upgradePolicy: UpgradePolicy
  computePolicy: MissingDefinitionComputePolicy
  logger?: Logger
}

class RecomputeHandler implements IRecomputeHandler {
  declare _upgradePolicy: UpgradePolicy
  declare _computePolicy: MissingDefinitionComputePolicy
  declare _logger: Logger

  constructor(options: RecomputeHandlerOptions) {
    this._upgradePolicy = options.upgradePolicy
    this._computePolicy = options.computePolicy
    this._logger = options.logger || logger()
  }

  set currentSchema(schemaVersion: string) {
    this._upgradePolicy.currentSchema = schemaVersion
  }

  get currentSchema(): string | undefined {
    return this._upgradePolicy.currentSchema
  }

  async validate(definition: Definition | null): Promise<Definition | null> {
    return this._upgradePolicy.validate(definition)
  }

  async initialize(): Promise<void> {
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

  async setupProcessing(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void> {
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

  async compute(definitionService: RecomputeContext, coordinates: EntityCoordinates): Promise<Definition> {
    return this._computePolicy.compute(definitionService, coordinates)
  }
}

function getPolicyName(policy: any): string {
  return policy?.constructor ? policy.constructor.name : 'UnknownPolicy'
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=versionCheck.
 * Only `logger` is used from options; any other properties (e.g. `queue`) are intentionally ignored.
 */
function defaultFactory({ logger }: Pick<DefinitionVersionCheckerOptions, 'logger'> = {}): RecomputeHandler {
  return new RecomputeHandler({
    upgradePolicy: versionCheckFactory({ logger }),
    computePolicy: new OnDemandComputePolicy(),
    logger
  })
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=upgradeQueue.
 */
function delayedFactory(options: DelayedFactoryOptions = {}): RecomputeHandler {
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

export { defaultFactory, delayedFactory, RecomputeHandler }
export default { defaultFactory, delayedFactory }
