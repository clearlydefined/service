// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { MissingDefinitionComputePolicy } from './computePolicy.js'
import type { RecomputeContext } from '../../business/definitionService.js'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'

export declare class OnDemandComputePolicy implements MissingDefinitionComputePolicy {
  initialize(): Promise<void>
  setupProcessing(): Promise<void>
  compute(
    definitionService: RecomputeContext,
    coordinates: EntityCoordinates
  ): Promise<import('../../business/definitionService').Definition>
}
