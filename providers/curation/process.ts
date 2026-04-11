// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type Curation from '../../lib/curation.ts'
import type { Logger } from '../logging/index.js'
import type { IQueue } from '../queueing/index.js'
import type { GitHubPR } from './index.js'

/** Minimum curation-service shape required by the queue processor */
export interface CurationProcessService {
  getContributedCurations(number: number, sha: string): Promise<Curation[]>
  validateContributions(number: number, sha: string, curations: Curation[]): Promise<void>
  updateContribution(pr: GitHubPR, curations?: Curation[] | null): Promise<void>
  addByMergedCuration(pr: GitHubPR): Promise<void>
}

/** Payload shape expected inside dequeued webhook messages */
export interface CurationWebhookPayload {
  pull_request: GitHubPR
  action: string
}

import lodash from 'lodash'

const { get } = lodash

async function work(once: boolean) {
  try {
    const message = await queue.dequeue()
    if (!message || !get(message, 'data.pull_request') || !get(message, 'data.action')) {
      return
    }
    const { data } = message
    if (!data) {
      return
    }
    const pr = data.pull_request
    const action = data.action
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
  } catch (error) {
    logger.error(String(error))
  } finally {
    if (!once) {
      setTimeout(work, 30000, once)
    }
  }
}

let queue: IQueue<CurationWebhookPayload>
let curationService: CurationProcessService
let logger: Logger

function setup(
  _queue: IQueue<CurationWebhookPayload>,
  _curationService: CurationProcessService,
  _logger: Logger,
  once: boolean = false
) {
  queue = _queue
  curationService = _curationService
  logger = _logger
  return work(once)
}

export default setup
