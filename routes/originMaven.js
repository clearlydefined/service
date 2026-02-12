// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('../lib/fetch').callFetch
const { uniq } = require('lodash')

// maven.org API documentation https://search.maven.org/classic/#api

// Get versions
router.get(
  '/:group/:artifact/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { group, artifact } = request.params
      const url = `https://search.maven.org/solrsearch/select?q=g:"${group}"+AND+a:"${artifact}"&core=gav&rows=100&wt=json`
      const answer = await requestPromise({ url, method: 'GET', json: true })
      const result = answer.response.docs.map((/** @type {any} */ item) => item.v)
      return response.status(200).send(uniq(result))
    } catch (e) {
      const error = /** @type {any} */ (e)
      if (error.code === 404) return response.status(200).send([])
      // TODO what to do on non-404 errors? Log for sure but what do we give back to the caller?
      return response.status(200).send([])
    }
  })
)

// Search
router.get(
  '/:group{/:artifact}',
  asyncMiddleware(async (request, response) => {
    const group = /** @type {string} */ (request.params.group)
    const artifact = request.params.artifact
    if (request.path.indexOf('/', 1) > 0) {
      const url = `https://search.maven.org/solrsearch/select?q=g:"${group}"+AND+a:"${artifact}"&rows=100&wt=json`
      const answer = await requestPromise({ url, method: 'GET', json: true })
      const result = getSuggestions(answer, group)
      return response.status(200).send(result)
    }
    const url = `https://search.maven.org/solrsearch/select?q=${group}&rows=100&wt=json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = getSuggestions(answer)
    return response.status(200).send(result)
  })
)

/**
 * @param {any} answer
 * @param {string} [group]
 */
function getSuggestions(answer, group) {
  const docs = answer.response.docs
  if (docs.length)
    return docs.map((/** @type {any} */ item) => {
      return { id: escapeHTML(item.id) }
    })
  const suggestions = answer.spellcheck?.suggestions?.[1]
  const result = suggestions ? suggestions.suggestion : []
  return group
    ? result.map((/** @type {any} */ entry) => `${escapeHTML(group)}:${escapeHTML(entry)}`)
    : result.map((/** @type {any} */ entry) => escapeHTML(entry))
}

function setup(testFlag = false) {
  if (testFlag) {
    const _router = /** @type {any} */ (router)
    _router._getSuggestions = getSuggestions
  }
  return router
}

function escapeHTML(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

module.exports = setup
