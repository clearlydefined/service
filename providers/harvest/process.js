// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const EntityCoordinates = require('../../lib/entityCoordinates')

async function work(once) {
  let isQueueEmpty = true
  try {
    const messages = await queue.dequeueMultiple()
    if (messages && messages.length > 0) isQueueEmpty = false
    await Promise.all(
      messages.map(message => {
        const urn = get(message, 'data._metadata.links.self.href')
        if (!urn) return
        const coordinates = EntityCoordinates.fromUrn(urn)
        return definitionService
          .computeAndStore(coordinates)
          .then(queue.delete(message))
          .then(async () => logger.info(`Handled Crawler update event for ${urn}`))
      })
    )
  } catch (error) {
    logger.error(error)
  } finally {
    if (!once) {
      setTimeout(work, isQueueEmpty ? 10000 : 0)
    }
  }
}

let queue
let definitionService
let logger

function setup(_queue, _definitionService, _logger, once = false) {
  queue = _queue
  definitionService = _definitionService
  logger = _logger
  return work(once)
}

module.exports = setup
