// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging/index.js'
import type { IQueue } from '../queueing/index.js'
import type {
  Definition,
  DefinitionService,
  RecomputeContext,
  RecomputeHandler as IRecomputeHandler,
  UpgradeHandler
} from '../../business/definitionService.js'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { MissingDefinitionComputePolicy } from './computePolicy.js'
import type { DefinitionVersionCheckerOptions } from './defVersionCheck.ts'

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

export declare class RecomputeHandler implements IRecomputeHandler {
  currentSchema?: string

  constructor(options: {
    upgradePolicy: UpgradePolicy
    computePolicy: MissingDefinitionComputePolicy
    logger?: Logger
  })

  validate(definition: Definition | null): Promise<Definition | null>

  initialize(): Promise<void>

  setupProcessing(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void>

  compute(definitionService: RecomputeContext, coordinates: EntityCoordinates): Promise<Definition>
}

/**
 * Compatibility alias for DEFINITION_UPGRADE_PROVIDER=versionCheck.
 * Only `logger` is used; any other properties are intentionally ignored.
 */
export declare function defaultFactory(options?: Pick<DefinitionVersionCheckerOptions, 'logger'>): RecomputeHandler

/** Compatibility alias for DEFINITION_UPGRADE_PROVIDER=upgradeQueue */
export declare function delayedFactory(options?: DelayedFactoryOptions): RecomputeHandler
