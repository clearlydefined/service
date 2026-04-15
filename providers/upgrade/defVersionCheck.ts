// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import { gte } from 'semver'
import type { Definition, DefinitionService, UpgradeHandler } from '../../business/definitionService.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'

const { get } = lodash

import EntityCoordinates from '../../lib/entityCoordinates.ts'

/** Configuration options for DefinitionVersionChecker */
export interface DefinitionVersionCheckerOptions {
  /** Logger instance for logging operations */
  logger?: Logger
}

class DefinitionVersionChecker implements UpgradeHandler {
  options: DefinitionVersionCheckerOptions
  logger: Logger
  declare _currentSchema: string | undefined

  constructor(options: DefinitionVersionCheckerOptions = {}) {
    this.options = options
    this.logger = this.options.logger || logger()
  }

  set currentSchema(schemaVersion: string) {
    this._currentSchema = schemaVersion
  }

  get currentSchema(): string | undefined {
    return this._currentSchema
  }

  async validate(definition: Definition | null): Promise<Definition | undefined> {
    if (!this._currentSchema) {
      throw new Error('Current schema version is not set')
    }
    const defSchemaVersion = get(definition, '_meta.schemaVersion')
    this.logger.debug(
      `Definition version: ${defSchemaVersion}, Current schema version: ${this._currentSchema}, Coordinates: ${DefinitionVersionChecker.getCoordinates(definition!)}`
    )
    if (defSchemaVersion && gte(defSchemaVersion, this._currentSchema)) {
      return definition!
    }
    return undefined
  }

  async initialize(): Promise<void> {
    //do nothing for initialization
  }

  setupProcessing(_definitionService?: DefinitionService, _logger?: Logger, _once?: boolean): void {
    //do nothing for set up processing
  }

  static getCoordinates(definition: Definition | null): string | undefined {
    return definition?.coordinates && EntityCoordinates.fromObject(definition.coordinates)!.toString()
  }
}

const factory = (options?: DefinitionVersionCheckerOptions): DefinitionVersionChecker =>
  new DefinitionVersionChecker(options)

export { DefinitionVersionChecker, factory }
