// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging'
import type { DequeuedMessage, IQueue } from '../queueing'

/** Minimum curation-service shape required by the queue processor */
export interface CurationProcessService {
  getContributedCurations(number: number, sha: string): Promise<import('../../lib/curation')[]>
  validateContributions(number: number, sha: string, curations: import('../../lib/curation')[]): Promise<void>
  updateContribution(pr: import('.').GitHubPR, curations?: import('../../lib/curation')[] | null): Promise<void>
  addByMergedCuration(pr: import('.').GitHubPR): Promise<void>
}

/** Payload shape expected inside dequeued webhook messages */
export interface CurationWebhookPayload {
  pull_request: import('.').GitHubPR
  action: string
}

/**
 * Sets up the curation queue processor. Continuously dequeues webhook messages
 * and delegates to the curation service.
 *
 * @param queue - The queue to read webhook events from
 * @param curationService - The curation service that handles PR events
 * @param logger - Logger instance
 * @param once - If true, process one message and stop (for testing). Defaults to false.
 * @returns Promise that resolves after the first message is processed (or the loop starts)
 */
declare function setup(
  queue: IQueue<CurationWebhookPayload>,
  curationService: CurationProcessService,
  logger: Logger,
  once?: boolean
): Promise<void>

export = setup
