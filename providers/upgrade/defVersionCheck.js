// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import { gte } from 'semver'
import logger from '../logging/logger.ts'

const { get } = lodash

import EntityCoordinates from '../../lib/entityCoordinates.ts'

/**
 * @typedef {import('../logging').Logger} Logger
 * @typedef {import('../../business/definitionService').Definition} Definition
 * @typedef {import('../caching').ICache} ICache
 */

class DefinitionVersionChecker {
  /** @param {import('./defVersionCheck').DefinitionVersionCheckerOptions} [options] */
  constructor(options = {}) {
    this.options = options
    this.logger = this.options.logger || logger()
  }

  /** @param {string} schemaVersion */
  set currentSchema(schemaVersion) {
    this._currentSchema = schemaVersion
  }

  /** @returns {string} */
  get currentSchema() {
    return this._currentSchema
  }

  /**
   * @param {Definition | null} definition
   * @returns {Promise<Definition | undefined>}
   */
  async validate(definition) {
    if (!this._currentSchema) {
      throw new Error('Current schema version is not set')
    }
    const defSchemaVersion = get(definition, '_meta.schemaVersion')
    this.logger.debug(
      `Definition version: ${defSchemaVersion}, Current schema version: ${this._currentSchema}, Coordinates: ${DefinitionVersionChecker.getCoordinates(definition)}`
    )
    if (defSchemaVersion && gte(defSchemaVersion, this._currentSchema)) {
      return definition
    }
    return undefined
  }

  async initialize() {
    //do nothing for initialization
  }

  /**
   * @param {import('../../business/definitionService').DefinitionService} [_definitionService]
   * @param {Logger} [_logger]
   * @param {boolean} [_once]
   * @param {ICache} [_cache]
   */
  setupProcessing(_definitionService, _logger, _once, _cache) {
    //do nothing for set up processing
  }

  /**
   * @param {Definition} definition
   * @returns {string | undefined}
   */
  static getCoordinates(definition) {
    return definition?.coordinates && EntityCoordinates.fromObject(definition.coordinates).toString()
  }
}

/**
 * @param {import('./defVersionCheck').DefinitionVersionCheckerOptions} [options]
 * @returns {DefinitionVersionChecker}
 */
const factory = options => new DefinitionVersionChecker(options)

export { DefinitionVersionChecker, factory }
