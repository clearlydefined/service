// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { parseUrn } = require('../../lib/utils')
const Cache = require('../caching/memory')

const defaultTtlSeconds = 60 * 5 /* 5 mins */
const retryDelayInMSeconds = 500

async function work(once) {
  let isQueueEmpty = true
  try {
    const messages = await queue.dequeueMultiple()
    if (messages && messages.length > 0) isQueueEmpty = false
    await Promise.all(messages.map(message => processMessage(message)))
  } catch (error) {
    logger.error(error)
  } finally {
    if (!once) {
      setTimeout(work, isQueueEmpty ? 10000 : 0)
    }
  }
}

async function processMessage(message) {
  const urn = get(message, 'data._metadata.links.self.href')
  if (!urn) return
  const coordinates = EntityCoordinates.fromUrn(urn)

  while (computeLock.get(coordinates.toString())) {
    await new Promise(resolve => setTimeout(resolve, retryDelayInMSeconds))
  }
  try {
    computeLock.set(coordinates.toString(), true)
    await computeIfNecessary(coordinates, urn)
  } finally {
    computeLock.delete(coordinates.toString())
  }
  await queue.delete(message)
  logger.info(`Handled Crawler update event for ${urn}`)
}

async function computeIfNecessary(coordinates, urn) {
  const { tool, toolRevision } = parseUrn(urn)
  if (tool === 'clearlydefined') {
    await definitionService.computeStoreAndCurate(coordinates)
  } else {
    const definitionFound = await definitionService.getStored(coordinates)
    const urnToolVersion = `${tool}/${toolRevision}`
    if (definitionFound?.described?.tools.includes(urnToolVersion)) {
      logger.info('Skip definition computation as the tool result has already been processed', { urn })
    } else {
      await definitionService.computeAndStore(coordinates)
    }
  }
}

let queue
let definitionService
let logger
let computeLock

function setup(_queue, _definitionService, _logger, once = false, lock = Cache({ defaultTtlSeconds })) {
  queue = _queue
  definitionService = _definitionService
  logger = _logger
  computeLock = lock
  return work(once)
}

module.exports = setup
