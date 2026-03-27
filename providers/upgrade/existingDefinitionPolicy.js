// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Policy for delayed compute queue processing.
 * Treat any existing definition as valid so compute queue only handles missing definitions.
 */
class ExistingDefinitionPolicy {
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
  ExistingDefinitionPolicy
}
