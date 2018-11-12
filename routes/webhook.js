// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const EntityCoordinates = require('../lib/entityCoordinates')
const { get } = require('lodash')

const validPrActions = ['opened', 'reopened', 'synchronize', 'closed']
let githubSecret = null
let crawlerSecret = null
let logger = null
let curationService
let definitionService
let test = false

router.post('/', handlePost)
async function handlePost(request, response) {
  if (request.headers['x-crawler']) return handleCrawlerCall(request, response)
  handleGitHubCall(request, response)
}

async function handleGitHubCall(request, response) {
  const body = validateGitHubCall(request, response)
  // if there is no body return 200 regardless so the caller does not get upset and stop sending webhooks.
  if (!body) return response.status(200).end()
  const pr = body.pull_request
  try {
    switch (body.action) {
      case 'opened': {
        await curationService.prOpened(pr)
        break
      }
      case 'closed': {
        await (pr.merged ? curationService.prMerged(pr) : curationService.prClosed(pr))
        break
      }
      case 'synchronize': {
        curationService.prUpdated(pr)
        break
      }
    }
  } catch (error) {
    // TODO log here
  }
  response.status(200).end()
}

async function handleCrawlerCall(request, response) {
  if (request.headers['x-crawler'] !== crawlerSecret) return fatal(request, response, 400, 'Invalid token')
  const body = JSON.parse(request.body)
  const urn = get(body, '_metadata.links.self.href')
  if (!urn) return fatal(request, response, 400, 'Missing or invalid "self" link')
  const coordinates = EntityCoordinates.fromUrn(urn)
  // TODO validate the coordinates are complete
  await definitionService.computeAndStore(coordinates)
  response.status(200).end()
}

function validateGitHubSignature(request, response) {
  if (request.hostname && request.hostname.includes('localhost')) return true
  const isGithubEvent = request.headers['x-github-event']
  const signature = request.headers['x-hub-signature']
  if (!isGithubEvent || !signature)
    return fatal(request, response, 400, 'Missing signature or event type on GitHub webhook')

  const computedSignature =
    'sha1=' +
    crypto
      .createHmac('sha1', githubSecret)
      .update(request.body)
      .digest('hex')
  if (!test && !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature)))
    return fatal(request, response, 400, 'X-Hub-Signature does not match blob signature')
  return true
}

function validateGitHubCall(request, response) {
  if (!validateGitHubSignature(request, response)) return false
  const body = JSON.parse(request.body)
  const isValidPullRequest = body.pull_request && validPrActions.includes(body.action)
  if (!isValidPullRequest) return fatal(request, response, 200)
  return body
}

function fatal(request, response, code, error = null) {
  error && logger.error('fatal webhook error', error)
  response.status(code)
  response.setHeader('content-type', 'text/plain')
  response.end(error)
  return false
}

function setup(curation, definition, appLogger, githubToken, crawlerToken, testFlag = false) {
  curationService = curation
  ;(definitionService = definition), (githubSecret = githubToken)
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
