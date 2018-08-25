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
  if (!body) return
  const pr = body.pull_request
  if (body.action === 'closed') {
    if (pr.merged) {
      const coordinateList = await curationService.getCurationCoordinates(pr.number, pr.head.ref)
      await definitionService.invalidate(coordinateList)
      await Promise.all(coordinateList.map(coordinates => definitionService.computeAndStore(coordinates)))
    }
  } else await curationService.validateCurations(pr.number, pr.head.sha, pr.head.ref)
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

function validateGitHubCall(request, response) {
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

  const body = JSON.parse(request.body)
  const isValidPullRequest = body.pull_request && validPrActions.includes(body.action)
  if (!isValidPullRequest) return fatal(request, response, 200)
  return body
}

function fatal(request, response, code, error = null) {
  logger.error(error)
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
