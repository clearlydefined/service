// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Upgrade policy for delayed compute queue processing.
 * Always treats the stored definition as valid, effectively skipping staleness checks.
 * Used by the delayed compute path to implement missing-only semantics.
 */
class SkipUpgradePolicy {
  /** @param {string} schemaVersion */
  set currentSchema(schemaVersion) {
    this._currentSchema = schemaVersion
  }

  /** @returns {string | undefined} */
  get currentSchema() {
    return this._currentSchema
  }

  /**
   * @param {import('../../business/definitionService').Definition | null} definition
   * @returns {Promise<import('../../business/definitionService').Definition | undefined>}
   */
  async validate(definition) {
    return definition || undefined
  }
}

module.exports = {
  SkipUpgradePolicy
}
