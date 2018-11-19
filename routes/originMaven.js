// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const utils = require('../lib/utils')

// Get versions
router.get(
  '/:group/:artifact/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { group, artifact } = request.params
      const url = `https://search.maven.org/solrsearch/select?q=g:"${group}"+AND+a:"${artifact}"&core=gav&rows=100&wt=json`
      const answer = await requestPromise({ url, method: 'GET', json: true })
      const result = answer.response.docs.map(item => item.v)
      return response.status(200).send(utils.filterForUniqueItemsOnly(result))
    } catch (error) {
      if (error.code === 404) return response.status(200).send([])
      // TODO what to do on non-404 errors? Log for sure but what do we give back to the caller?
      return response.status(200).send([])
    }
  })
)

// Search
router.get(
  '/:group/:artifact?',
  asyncMiddleware(async (request, response) => {
    const { group, artifact } = request.params
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

function getSuggestions(answer, group) {
  const docs = answer.response.docs
  if (docs.length)
    return docs.map(item => {
      return { id: item.id }
    })
  const suggestions = answer.spellcheck.suggestions[1]
  const result = suggestions ? suggestions.suggestion : []
  return group ? result.map(entry => `${group}:${entry}`) : result
}

function setup() {
  return router
}

module.exports = setup
