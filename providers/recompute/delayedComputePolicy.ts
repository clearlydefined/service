// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, DefinitionService, RecomputeContext } from '../../business/definitionService.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { ISyncCache } from '../caching/index.js'
import Cache from '../caching/memory.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { IQueue } from '../queueing/index.js'
import type { MissingDefinitionComputePolicy } from './computePolicy.js'
import type { DefinitionQueueUpgraderOptions } from './defUpgradeQueue.ts'
import { setup } from './process.ts'
import { SkipUpgradePolicy } from './skipUpgradePolicy.ts'

export interface DelayedComputePolicyOptions extends DefinitionQueueUpgraderOptions {
  /** Injectable for testing; defaults to an in-memory cache with 20-minute TTL */
  enqueueCache?: ISyncCache<boolean>
}

class DelayedComputePolicy implements MissingDefinitionComputePolicy {
  static _enqueueCacheTtlSeconds =
    60 * 20 /* 20 mins; matches visibilityTimeout to avoid re-enqueuing in-flight items */

  options: DelayedComputePolicyOptions
  logger: Logger
  declare _enqueueCache: ISyncCache<boolean>
  declare _compute: IQueue

  constructor(options: DelayedComputePolicyOptions) {
    this.options = options
    this.logger = options.logger || logger()
    this._enqueueCache =
      options.enqueueCache || Cache({ defaultTtlSeconds: DelayedComputePolicy._enqueueCacheTtlSeconds })
  }

  async initialize(): Promise<void> {
    this._compute = this.options.queue()
    return this._compute.initialize()
  }

  setupProcessing(definitionService: DefinitionService, logger: Logger, once?: boolean): Promise<void> | void {
    const upgradePolicy = new SkipUpgradePolicy()
    return setup(this._compute, definitionService, logger, once, upgradePolicy)
  }

  async compute(definitionService: RecomputeContext, coordinates: EntityCoordinates): Promise<Definition> {
    await this._queueCompute(coordinates)
    return definitionService.buildEmptyDefinition(coordinates)
  }

  async _queueCompute(coordinates: EntityCoordinates): Promise<void> {
    if (!this._compute) {
      throw new Error('Compute queue is not set. DelayedComputePolicy.initialize() must be called before compute()')
    }
    const key = coordinates.toString()
    const alreadyQueued = this._enqueueCache.get(key)
    if (alreadyQueued === true) {
      this.logger.debug('Skipped duplicate enqueue for delayed definition compute', { coordinates: key })
      return
    }
    this._enqueueCache.set(key, true, DelayedComputePolicy._enqueueCacheTtlSeconds)
    try {
      const message = this._constructMessage(coordinates)
      await this._compute.queue(message)
    } catch (error) {
      // Roll back optimistic dedup marker so retries can enqueue after transient queue failures.
      this._enqueueCache.delete(key)
      throw error
    }
    this.logger.info('Queued for delayed definition compute', {
      coordinates: key
    })
  }

  _constructMessage(coordinates: EntityCoordinates): string {
    return Buffer.from(JSON.stringify({ coordinates })).toString('base64')
  }
}

export { DelayedComputePolicy }
