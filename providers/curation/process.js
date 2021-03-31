// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')

async function work(once) {
  try {
    let message = await queue.dequeue()
    if (!get(message, 'data.pull_request') || !get(message, 'data.action')) return
    const pr = message.data.pull_request
    const action = message.data.action
    switch (action) {
      case 'opened':
      case 'synchronize': {
        const curations = await curationService.getContributedCurations(pr.number, pr.head.sha)
        await curationService.validateContributions(pr.number, pr.head.sha, curations)
        await curationService.updateContribution(pr, curations)
        break
      }
      case 'closed': {
        await curationService.addByMergedCuration(pr)
        await curationService.updateContribution(pr)
        break
      }
    }
    logger.info(`Handled GitHub event "${action}" for PR#${pr.number}`)
    await queue.delete(message)
  } catch (error) {
    logger.error(error)
  } finally {
    if (!once) setTimeout(work, 30000, once)
  }
}

let queue
let curationService
let logger

function setup(_queue, _curationService, _logger, once = false) {
  queue = _queue
  curationService = _curationService
  logger = _logger
  return work(once)
}

module.exports = setup
