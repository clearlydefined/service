// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, DefinitionService } from '../../business/definitionService'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { Logger } from '../logging'

export interface MissingDefinitionComputePolicy {
  initialize?(): Promise<void> | void
  setupProcessing?(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void> | void
  compute(definitionService: DefinitionService, coordinates: EntityCoordinates): Promise<Definition | undefined>
}
