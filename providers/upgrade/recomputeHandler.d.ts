// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
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
import type { MissingDefinitionComputePolicy } from './computePolicy'

export declare class RecomputeHandler implements IRecomputeHandler {
  currentSchema?: string

  constructor(options: { upgradePolicy: UpgradeHandler; computePolicy?: MissingDefinitionComputePolicy })

  validate(definition: Definition | null): Promise<Definition | null>

  initialize(): Promise<void>

  setupProcessing(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void>

  compute(definitionService: DefinitionService, coordinates: EntityCoordinates): Promise<Definition | undefined>
}

/** Compatibility alias for DEFINITION_UPGRADE_PROVIDER=versionCheck */
export declare function defaultFactory(options?: DefinitionVersionCheckerOptions): RecomputeHandler

/** Compatibility alias for DEFINITION_UPGRADE_PROVIDER=upgradeQueue */
export declare function delayedFactory(options?: DefinitionQueueUpgraderOptions): RecomputeHandler
