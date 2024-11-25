// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { factory } = require('./defVersionCheck')

async function work(once) {
  let isQueueEmpty = true
  try {
    const messages = await queue.dequeueMultiple()
    if (messages && messages.length > 0) isQueueEmpty = false
    const results = await Promise.allSettled(messages.map(message => processMessage(message)))
    results.filter(result => result.status === 'rejected').forEach(result => logger.error(result.reason))
  } catch (error) {
    logger.error(error)
  } finally {
    if (!once) setTimeout(work, isQueueEmpty ? 10000 : 0)
  }
}

async function processMessage(message) {
  let coordinates = get(message, 'data.coordinates')
  if (!coordinates) return
  coordinates = EntityCoordinates.fromObject(coordinates)

  const existing = await definitionService.getStored(coordinates)
  let result = await defVersionChecker.validate(existing)
  if (result) return //valid definition, no need to upgrade
  await definitionService.computeStoreAndCurate(coordinates)
  await queue.delete(message)
  logger.info(`Handled definition update for ${coordinates.toString()}`)
}

let queue
let definitionService
let logger
let defVersionChecker

function setup(_queue, _definitionService, _logger, _defVersionChecker = factory(), once = false) {
  queue = _queue
  definitionService = _definitionService
  logger = _logger
  defVersionChecker = _defVersionChecker
  defVersionChecker.currentSchema = definitionService.currentSchema
  return work(once)
}

module.exports = setup
