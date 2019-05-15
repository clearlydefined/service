// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')

async function work() {
  try {
    let message = await queue.dequeue()
    const urn = get(message, 'data._metadata.links.self.href')
    if (!urn) return
    const coordinates = EntityCoordinates.fromUrn(urn)
    await definitionService.computeAndStore(coordinates)
    logger.info(`Handled Crawler update event for ${urn}`)
    await queue.delete(message)
  } catch (error) {
    logger.error(error)
  } finally {
    setTimeout(work, 250)
  }
}

let queue
let definitionService
let logger

function setup(_queue, _definitionService, _logger) {
  queue = _queue
  definitionService = _definitionService
  logger = _logger
  return work()
}

module.exports = setup
