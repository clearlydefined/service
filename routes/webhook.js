// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const EntityCoordinates = require('../lib/entityCoordinates')
const { get } = require('lodash')
const asyncMiddleware = require('../middleware/asyncMiddleware')
const { parseUrn } = require('../lib/utils')

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

const validPrActions = ['opened', 'reopened', 'synchronize', 'closed']
/** @type {string | null} */
let githubSecret = null
/** @type {string | null} */
let crawlerSecret = null
/** @type {any} */
let logger = null
/** @type {any} */
let curationService
/** @type {any} */
let definitionService
let test = false

router.post('/', asyncMiddleware(handlePost))
/**
 * @param {Request} request
 * @param {Response} response
 */
function handlePost(request, response) {
  if (request.headers['x-crawler']) return handleCrawlerCall(request, response)
  return handleGitHubCall(request, response)
}

/**
 * @param {Request} request
 * @param {Response} response
 */
async function handleGitHubCall(request, response) {
  const body = validateGitHubCall(request, response)
  if (!body) return
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
    logger.info(`Handled GitHub event "${body.action}" for PR#${pr.number}`)
  } catch (exception) {
    const ex = /** @type {Error & {code?: number}} */ (exception)
    if (ex.code === 404) {
      info(request, response, 200, `Bad GitHub PR event: Non-existant PR#${pr.number}, action: ${body.action}`)
      return
    } else logger.error(ex)
  }
  response.status(200).end()
}

/**
 * @param {Request} request
 * @param {Response} response
 */
async function handleCrawlerCall(request, response) {
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
    await definitionService.computeStoreAndCurate(coordinates)
  } else {
    await definitionService.computeAndStoreIfNecessary(coordinates, tool, toolRevision)
  }
  logger.info(`Handled Crawler update event for ${urn}`)
  response.status(200).end()
}

/**
 * @param {Request} request
 * @param {Response} response
 * @returns {boolean}
 */
function validateGitHubSignature(request, response) {
  if (request.hostname && request.hostname.includes('localhost')) return true
  const isGithubEvent = request.headers['x-github-event']
  const signature = /** @type {string} */ (request.headers['x-hub-signature'])
  if (!isGithubEvent || !signature)
    return info(request, response, 400, 'Missing signature or event type on GitHub webhook')

  const computedSignature = 'sha1=' + crypto.createHmac('sha1', githubSecret).update(request.body).digest('hex')
  if (!test && !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature)))
    return info(request, response, 400, 'X-Hub-Signature does not match blob signature')
  return true
}

/**
 * @param {Request} request
 * @param {Response} response
 * @returns {any}
 */
function validateGitHubCall(request, response) {
  if (!validateGitHubSignature(request, response)) return false
  let body = request.body
  if (Buffer.isBuffer(body)) {
    body = JSON.parse(body.toString('utf8'))
  } else if (typeof body === 'string') {
    body = JSON.parse(body)
  }

  const isValidPullRequest = body.pull_request && validPrActions.includes(body.action)
  if (!isValidPullRequest) return info(request, response, 200)
  return body
}

/**
 * @param {Request} _request
 * @param {Response} response
 * @param {number} code
 * @param {string | null} [error]
 * @returns {false}
 */
function info(_request, response, code, error = null) {
  error && logger.info(`Fatal webhook error: ${error}`)
  response.status(code)
  response.setHeader('content-type', 'text/plain')
  response.end(error)
  return false
}

/**
 * @param {any} curation
 * @param {any} definition
 * @param {any} appLogger
 * @param {string} githubToken
 * @param {string} crawlerToken
 * @param {boolean} [testFlag]
 */
function setup(curation, definition, appLogger, githubToken, crawlerToken, testFlag = false) {
  curationService = curation
  definitionService = definition
  githubSecret = githubToken
  crawlerSecret = crawlerToken
  logger = appLogger
  test = testFlag
  if (test) {
    const _router = /** @type {any} */ (router)
    _router._handlePost = handlePost
    _router._validateGitHubCall = validateGitHubCall
  }
  return router
}

module.exports = setup
