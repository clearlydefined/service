// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response } from 'express'
import express from 'express'
import type { DefinitionService } from '../business/definitionService.ts'
import type { Logger } from '../providers/logging/index.js'

const router = express.Router()

import crypto from 'node:crypto'
import lodash from 'lodash'
import EntityCoordinates from '../lib/entityCoordinates.ts'

const { get } = lodash

import { parseUrn } from '../lib/utils.ts'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const validPrActions = ['opened', 'reopened', 'synchronize', 'closed']
let githubSecret: string | null = null
let crawlerSecret: string | null = null
let logger: Logger | null = null
let curationService: any
let definitionService: DefinitionService
let test = false

router.post('/', asyncMiddleware(handlePost))
function handlePost(request: Request, response: Response) {
  if (request.headers['x-crawler']) {
    return handleCrawlerCall(request, response)
  }
  return handleGitHubCall(request, response)
}

async function handleGitHubCall(request: Request, response: Response) {
  const body = validateGitHubCall(request, response)
  if (!body) {
    return
  }
  const pr = body.pull_request
  try {
    switch (body.action) {
      case 'opened':
      case 'reopened':
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
    logger!.info(`Handled GitHub event "${body.action}" for PR#${pr.number}`)
  } catch (exception) {
    const ex = exception as Error & { code?: number }
    if (ex.code === 404) {
      info(request, response, 200, `Bad GitHub PR event: Non-existant PR#${pr.number}, action: ${body.action}`)
      return
    }
    logger!.error(ex as any)
  }
  response.status(200).end()
}

async function handleCrawlerCall(request: Request, response: Response) {
  if (request.headers['x-crawler'] !== crawlerSecret) {
    info(request, response, 400, 'Invalid token')
    return
  }
  let body = request.body
  if (Buffer.isBuffer(body)) {
    body = JSON.parse(body.toString('utf8'))
  } else if (typeof body === 'string') {
    body = JSON.parse(body)
  }
  const urn = get(body, '_metadata.links.self.href')
  if (!urn) {
    info(request, response, 400, 'Missing or invalid "self" link')
    return
  }
  const coordinates = EntityCoordinates.fromUrn(urn)
  // TODO validate the coordinates are complete
  const { tool, toolRevision } = parseUrn(urn)
  if (tool === 'clearlydefined') {
    await definitionService.computeStoreAndCurate(coordinates!)
  } else {
    await definitionService.computeAndStoreIfNecessary(coordinates!, tool!, toolRevision!)
  }
  logger!.info(`Handled Crawler update event for ${urn}`)
  response.status(200).end()
}

function validateGitHubSignature(request: Request, response: Response): boolean {
  if (request.hostname?.includes('localhost')) {
    return true
  }
  const isGithubEvent = request.headers['x-github-event']
  const signature = request.headers['x-hub-signature'] as string | undefined
  if (!isGithubEvent || !signature) {
    return info(request, response, 400, 'Missing signature or event type on GitHub webhook')
  }

  const computedSignature = `sha1=${crypto.createHmac('sha1', githubSecret!).update(request.body).digest('hex')}`
  if (!test && !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
    return info(request, response, 400, 'X-Hub-Signature does not match blob signature')
  }
  return true
}

function validateGitHubCall(request: Request, response: Response): any {
  if (!validateGitHubSignature(request, response)) {
    return false
  }
  let body = request.body
  if (Buffer.isBuffer(body)) {
    body = JSON.parse(body.toString('utf8'))
  } else if (typeof body === 'string') {
    body = JSON.parse(body)
  }

  const isValidPullRequest = body.pull_request && validPrActions.includes(body.action)
  if (!isValidPullRequest) {
    return info(request, response, 200)
  }
  return body
}

function info(_request: Request, response: Response, code: number, error: string | null = null): false {
  error && logger!.info(`Fatal webhook error: ${error}`)
  response.status(code)
  response.setHeader('content-type', 'text/plain')
  response.end(error)
  return false
}

function setup(
  curation: any,
  definition: DefinitionService,
  appLogger: Logger,
  githubToken: string,
  crawlerToken: string,
  testFlag: boolean = false
): import('express').Router {
  curationService = curation
  definitionService = definition
  githubSecret = githubToken
  crawlerSecret = crawlerToken
  logger = appLogger
  test = testFlag
  if (test) {
    const _router = router as any
    _router._handlePost = handlePost
    _router._validateGitHubCall = validateGitHubCall
  }
  return router
}

export default setup
