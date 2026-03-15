// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Default on-demand compute policy.
 * @returns {import('./computePolicy').MissingDefinitionComputePolicy}
 */
function createOnDemandComputePolicy() {
  return {
    async initialize() {},
    setupProcessing() {},
    async compute(definitionService, coordinates) {
      return definitionService.computeStoreAndCurate(coordinates)
    }
  }
}

module.exports = {
  createOnDemandComputePolicy
}
