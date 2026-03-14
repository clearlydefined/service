// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging'
import type {
  Definition,
  DefinitionService,
  RecomputeHandler as IRecomputeHandler,
  UpgradeHandler
} from '../../business/definitionService'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { DefinitionVersionCheckerOptions } from './defVersionCheck'
import type { DefinitionQueueUpgraderOptions } from './defUpgradeQueue'

export interface ComputePolicy {
  initialize?(): Promise<void> | void
  setupProcessing?(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void> | void
  compute?(definitionService: DefinitionService, coordinates: EntityCoordinates): Promise<Definition | undefined>
}

export declare class RecomputeHandler implements IRecomputeHandler {
  currentSchema?: string

  constructor(options: { upgradePolicy: UpgradeHandler; computePolicy?: ComputePolicy })

  validate(definition: Definition | null): Promise<Definition | null>

  initialize(): Promise<void>

  setupProcessing(definitionService?: DefinitionService, logger?: Logger, once?: boolean): void

  compute(definitionService: DefinitionService, coordinates: EntityCoordinates): Promise<Definition | undefined>
}

export declare function createOnDemandComputePolicy(): ComputePolicy

/** Compatibility alias for DEFINITION_UPGRADE_PROVIDER=versionCheck */
export declare function defaultFactory(options?: DefinitionVersionCheckerOptions): RecomputeHandler

/** Compatibility alias for DEFINITION_UPGRADE_PROVIDER=upgradeQueue */
export declare function delayedFactory(options?: DefinitionQueueUpgraderOptions): RecomputeHandler
