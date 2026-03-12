// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { parseUrn } = require('../../lib/utils')

/**
 * @typedef {import('../queueing').DequeuedMessage} DequeuedMessage
 * @typedef {import('../queueing').IQueue} IQueue
 * @typedef {import('../../business/definitionService').DefinitionService} DefinitionService
 * @typedef {import('../logging').Logger} Logger
 */

/**
 * @param {boolean} [once]
 */
async function work(once) {
  let isQueueEmpty = true
  try {
    const messages = await queue.dequeueMultiple()
    if (messages && messages.length > 0) isQueueEmpty = false
    await Promise.all(messages.map(message => processMessage(message)))
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
  } finally {
    if (!once) {
      setTimeout(work, isQueueEmpty ? 10000 : 0)
    }
  }
}

/**
 * @param {DequeuedMessage} message
 */
async function processMessage(message) {
  const urn = get(message, 'data._metadata.links.self.href')
  if (!urn) return
  const coordinates = EntityCoordinates.fromUrn(urn)
  const { tool, toolRevision } = parseUrn(urn)
  if (tool === 'clearlydefined') {
    await definitionService.computeStoreAndCurate(coordinates)
  } else {
    await definitionService.computeAndStoreIfNecessary(coordinates, tool, toolRevision)
  }
  await queue.delete(message)
  logger.info(`Handled Crawler update event for ${urn}`)
}

/** @type {IQueue} */
let queue
/** @type {DefinitionService} */
let definitionService
/** @type {Logger} */
let logger

/**
 * @param {IQueue} _queue
 * @param {DefinitionService} _definitionService
 * @param {Logger} _logger
 * @param {boolean} [once]
 */
function setup(_queue, _definitionService, _logger, once = false) {
  queue = _queue
  definitionService = _definitionService
  logger = _logger
  return work(once)
}

module.exports = setup
