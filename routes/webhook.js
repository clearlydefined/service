// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const EntityCoordinates = require('../lib/entityCoordinates')
const { get } = require('lodash')
const asyncMiddleware = require('../middleware/asyncMiddleware')

const validPrActions = ['opened', 'reopened', 'synchronize', 'closed']
let githubSecret = null
let crawlerSecret = null
let logger = null
let curationService
let definitionService
let test = false

router.post('/', asyncMiddleware(handlePost))
function handlePost(request, response) {
  if (request.headers['x-crawler']) return handleCrawlerCall(request, response)
  return handleGitHubCall(request, response)
}

async function handleGitHubCall(request, response) {
  const body = validateGitHubCall(request, response)
  if (!body) return
  const pr = body.pull_request
  try {
    switch (body.action) {
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
    logger.info(`Handled GitHub event "${body.action}" for PR#${pr.number}`)
  } catch (exception) {
    if (exception.code === 404)
      return info(request, response, 200, `Bad GitHub PR event: Non-existant PR#${pr.number}, action: ${body.action}`)
    else logger.error(exception)
  }
  response.status(200).end()
}

async function handleCrawlerCall(request, response) {
  if (request.headers['x-crawler'] !== crawlerSecret) return info(request, response, 400, 'Invalid token')
  const body = JSON.parse(request.body)
  const urn = get(body, '_metadata.links.self.href')
  if (!urn) return info(request, response, 400, 'Missing or invalid "self" link')
  const coordinates = EntityCoordinates.fromUrn(urn)
  // TODO validate the coordinates are complete
  await definitionService.computeStoreAndCurate(coordinates)
  logger.info(`Handled Crawler update event for ${urn}`)
  response.status(200).end()
}

function validateGitHubSignature(request, response) {
  if (request.hostname && request.hostname.includes('localhost')) return true
  const isGithubEvent = request.headers['x-github-event']
  const signature = request.headers['x-hub-signature']
  if (!isGithubEvent || !signature)
    return info(request, response, 400, 'Missing signature or event type on GitHub webhook')

  const computedSignature =
    'sha1=' +
    crypto
      .createHmac('sha1', githubSecret)
      .update(request.body)
      .digest('hex')
  if (!test && !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature)))
    return info(request, response, 400, 'X-Hub-Signature does not match blob signature')
  return true
}

function validateGitHubCall(request, response) {
  if (!validateGitHubSignature(request, response)) return false
  const body = JSON.parse(request.body)
  const isValidPullRequest = body.pull_request && validPrActions.includes(body.action)
  if (!isValidPullRequest) return info(request, response, 200)
  return body
}

function info(request, response, code, error = null) {
  error && logger.info(`Fatal webhook error: ${error}`)
  response.status(code)
  response.setHeader('content-type', 'text/plain')
  response.end(error)
  return false
}

function setup(curation, definition, appLogger, githubToken, crawlerToken, testFlag = false) {
  curationService = curation
  definitionService = definition
  githubSecret = githubToken
  crawlerSecret = crawlerToken
  logger = appLogger
  test = testFlag
  if (test) {
    router._handlePost = handlePost
    router._validateGitHubCall = validateGitHubCall
  }
  return router
}

module.exports = setup
