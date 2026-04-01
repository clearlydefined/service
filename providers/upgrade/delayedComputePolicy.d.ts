// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, DefinitionService, RecomputeContext } from '../../business/definitionService'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { Logger } from '../logging'
import type { ICache } from '../caching'
import type { DefinitionQueueUpgraderOptions } from './defUpgradeQueue'
import type { MissingDefinitionComputePolicy } from './computePolicy'

export declare class DelayedComputePolicy implements MissingDefinitionComputePolicy {
  options: DefinitionQueueUpgraderOptions
  logger: Logger

  constructor(options: DefinitionQueueUpgraderOptions)

  initialize(): Promise<void>

  setupProcessing(definitionService: DefinitionService, logger: Logger, once?: boolean, cache?: ICache): Promise<void>

  compute(definitionService: RecomputeContext, coordinates: EntityCoordinates): Promise<Definition>
}
