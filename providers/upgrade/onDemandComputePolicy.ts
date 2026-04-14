// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, RecomputeContext } from '../../business/definitionService.js'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { MissingDefinitionComputePolicy } from './computePolicy.js'

class OnDemandComputePolicy implements MissingDefinitionComputePolicy {
  async initialize(): Promise<void> {}

  async setupProcessing(): Promise<void> {}

  async compute(definitionService: RecomputeContext, coordinates: EntityCoordinates): Promise<Definition> {
    return definitionService.computeStoreAndCurate(coordinates)
  }
}

export { OnDemandComputePolicy }
