// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class OnDemandComputePolicy {
  async initialize() {}

  async setupProcessing() {}

  /**
   * @param {import('../../business/definitionService').RecomputeContext} definitionService
   * @param {import('../../lib/entityCoordinates')} coordinates
   */
  async compute(definitionService, coordinates) {
    return definitionService.computeStoreAndCurate(coordinates)
  }
}

module.exports = {
  OnDemandComputePolicy
}
