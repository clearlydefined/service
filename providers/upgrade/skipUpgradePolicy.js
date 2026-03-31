// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Upgrade policy for delayed compute queue processing.
 * Always treats the stored definition as valid, effectively skipping staleness checks.
 * Used by the delayed compute path to implement missing-only semantics.
 */
class SkipUpgradePolicy {
  /**
   * @param {import('../../business/definitionService').Definition | null} definition
   * @returns {Promise<import('../../business/definitionService').Definition | null>}
   */
  async validate(definition) {
    return definition || null
  }
}

module.exports = {
  SkipUpgradePolicy
}
