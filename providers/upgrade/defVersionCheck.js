// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')
const { gte } = require('semver')
const { get } = require('lodash')

class DefinitionVersionChecker {
  constructor(options) {
    this.options = options || {}
    this.logger = this.options.logger || logger()
  }

  set currentSchema(schemaVersion) {
    this._currentSchema = schemaVersion
  }

  get currentSchema() {
    return this._currentSchema
  }

  async validate(definition) {
    if (!this._currentSchema) throw new Error('Current schema version is not set')
    const defSchemaVersion = get(definition, '_meta.schemaVersion')
    this.logger.debug(`Definition version: %s, Current schema version: %s`, defSchemaVersion, this._currentSchema)
    if (defSchemaVersion && gte(defSchemaVersion, this._currentSchema)) return definition
  }
}

const factory = options => new DefinitionVersionChecker(options)

module.exports = { DefinitionVersionChecker, factory }
