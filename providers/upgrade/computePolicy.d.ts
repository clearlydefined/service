// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, DefinitionService, RecomputeContext } from '../../business/definitionService.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'

export interface MissingDefinitionComputePolicy {
  initialize?(): Promise<void> | void
  setupProcessing?(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void> | void
  compute(definitionService: RecomputeContext, coordinates: EntityCoordinates): Promise<Definition>
}
