// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { callFetch: requestPromise } = require('../lib/fetch')
const { uniq } = require('lodash')

// Nuget API documentation: https://docs.microsoft.com/en-us/nuget/api/overview
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://api-v2v3search-0.nuget.org'
    const { name } = request.params
    const url = `${baseUrl}/autocomplete?id=${name}&prerelease=true`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    return response.status(200).send(uniq(answer.data))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://api-v2v3search-0.nuget.org'
    const { name } = request.params
    const url = `${baseUrl}/query?q=${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.data.map(entry => {
      return { id: entry.id }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
