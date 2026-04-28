// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, DefinitionService } from '../../business/definitionService.ts'
import type { Logger } from '../logging/index.js'
import type { IQueue } from '../queueing/index.js'
import type { DefinitionVersionCheckerOptions } from './defVersionCheck.ts'
import { DefinitionVersionChecker } from './defVersionCheck.ts'
import { setup } from './process.ts'

/** Configuration options for DefinitionQueueUpgrader */
export interface DefinitionQueueUpgraderOptions extends DefinitionVersionCheckerOptions {
  /** Factory function that creates the upgrade queue */
  queue: () => IQueue
}

class DefinitionQueueUpgrader extends DefinitionVersionChecker {
  declare options: DefinitionQueueUpgraderOptions
  declare _upgrade: IQueue

  constructor(options: DefinitionQueueUpgraderOptions) {
    super(options)
    this.options = options
  }

  override async validate(definition: Definition | null): Promise<Definition | undefined> {
    if (!definition) {
      return undefined
    }
    const result = await super.validate(definition)
    if (result) {
      return result
    }

    await this._queueUpgrade(definition)
    return definition
  }

  async _queueUpgrade(definition: Definition): Promise<void> {
    if (!this._upgrade) {
      throw new Error('Upgrade queue is not set')
    }
    try {
      const message = this._constructMessage(definition)
      await this._upgrade.queue(message)
      this.logger.info('Queued for definition upgrade ', {
        coordinates: DefinitionVersionChecker.getCoordinates(definition)
      })
    } catch (error) {
      //continue if queueing fails and requeue at the next request.
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Error queueing for definition upgrade ${message}`, {
        error,
        coordinates: DefinitionVersionChecker.getCoordinates(definition)
      })
    }
  }

  _constructMessage(definition: Definition): string {
    const { coordinates, _meta } = definition
    const content = { coordinates, _meta }
    return Buffer.from(JSON.stringify(content)).toString('base64')
  }

  override async initialize(): Promise<void> {
    this._upgrade = this.options.queue()
    return this._upgrade.initialize()
  }

  override setupProcessing(definitionService: DefinitionService, logger: Logger, once?: boolean): Promise<void> {
    // Use a plain DefinitionVersionChecker (not `this`) so the queue processor returns undefined
    // for stale definitions and triggers recompute — rather than re-queuing them again.
    return setup(this._upgrade, definitionService, logger, once, new DefinitionVersionChecker(this.options))
  }
}

export default DefinitionQueueUpgrader
