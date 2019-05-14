// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')

async function work() {
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
        await curationService.updateContribution(pr)
        break
      }
    }
    logger.info(`Handled GitHub event "${action}" for PR#${pr.number}`)
    await queue.delete(message)
  } catch (error) {
    logger.error(error)
  } finally {
    setTimeout(work, 30000)
  }
}

let queue
let curationService
let logger

function setup(_queue, _curationService, _logger) {
  queue = _queue
  curationService = _curationService
  logger = _logger
  work()
}

module.exports = setup
