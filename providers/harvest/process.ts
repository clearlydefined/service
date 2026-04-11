// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'

const { get } = lodash

import type { DefinitionService } from '../../business/definitionService.js'
import EntityCoordinates from '../../lib/entityCoordinates.ts'
import { parseUrn } from '../../lib/utils.ts'
import type { Logger } from '../logging/index.js'
import type { DequeuedMessage, IQueue } from '../queueing/index.js'

async function work(once?: boolean): Promise<void> {
  let isQueueEmpty = true
  try {
    const messages = await queue.dequeueMultiple()
    if (messages && messages.length > 0) {
      isQueueEmpty = false
    }
    await Promise.all(messages.map(message => processMessage(message)))
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
  } finally {
    if (!once) {
      setTimeout(work, isQueueEmpty ? 10000 : 0)
    }
  }
}

async function processMessage(message: DequeuedMessage): Promise<void> {
  const urn = get(message, 'data._metadata.links.self.href')
  if (!urn) {
    return
  }
  const coordinates = EntityCoordinates.fromUrn(urn)
  if (!coordinates) {
    return
  }
  const { tool, toolRevision } = parseUrn(urn)
  if (!tool) {
    return
  }
  if (tool === 'clearlydefined') {
    await definitionService.computeStoreAndCurate(coordinates)
  } else {
    await definitionService.computeAndStoreIfNecessary(coordinates, tool, toolRevision!)
  }
  await queue.delete(message)
  logger.info(`Handled Crawler update event for ${urn}`)
}

let queue: IQueue
let definitionService: DefinitionService
let logger: Logger

function setup(_queue: IQueue, _definitionService: DefinitionService, _logger: Logger, once = false): Promise<void> {
  queue = _queue
  definitionService = _definitionService
  logger = _logger
  return work(once)
}

export default setup
