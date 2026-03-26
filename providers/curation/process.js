// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('../queueing').IQueue<CurationWebhookPayload>} CurationQueue */
/** @typedef {import('./process').CurationWebhookPayload} CurationWebhookPayload */
/** @typedef {import('./process').CurationProcessService} CurationProcessService */
/** @typedef {import('../logging').Logger} Logger */

const { get } = require('lodash')

/** @param {boolean} once */
async function work(once) {
  try {
    const message = await queue.dequeue()
    if (!get(message, 'data.pull_request') || !get(message, 'data.action')) {
      return
    }
    const pr = message.data.pull_request
    const action = message.data.action
    switch (action) {
      case 'opened':
      case 'synchronize': {
        // Wait for ten seconds because GitHub use eventual consistency so that
        // later may not able to get PRs when event happened.
        await new Promise(resolve => setTimeout(resolve, 10 * 1000))
        const curations = await curationService.getContributedCurations(pr.number, pr.head.sha)
        await curationService.validateContributions(pr.number, pr.head.sha, curations)
        await curationService.updateContribution(pr, curations)
        break
      }
      case 'closed': {
        await new Promise(resolve => setTimeout(resolve, 10 * 1000))
        await curationService.addByMergedCuration(pr)
        await curationService.updateContribution(pr)
        break
      }
    }
    logger.info(`Handled GitHub event "${action}" for PR#${pr.number}`)
    await queue.delete(message)
  } catch (/** @type {*} */ error) {
    logger.error(error)
  } finally {
    if (!once) {
      setTimeout(work, 30000, once)
    }
  }
}

/** @type {CurationQueue} */
let queue
/** @type {CurationProcessService} */
let curationService
/** @type {Logger} */
let logger

/**
 * @param {CurationQueue} _queue
 * @param {CurationProcessService} _curationService
 * @param {Logger} _logger
 * @param {boolean} [once]
 */
function setup(_queue, _curationService, _logger, once = false) {
  queue = _queue
  curationService = _curationService
  logger = _logger
  return work(once)
}

module.exports = setup
