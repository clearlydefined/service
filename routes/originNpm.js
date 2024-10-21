// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { callFetch: requestPromise } = require('../lib/fetch')
const { uniq } = require('lodash')

// NPM API documentation: https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#:~:text=NPM%20Registry%20API%201%20Overview%202%20Schema.%20All,Authentication%20required.%20...%2010%20Search%20More%20items...%20
router.get(
  '/:namespace?/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://registry.npmjs.com'
    const { namespace, name } = request.params
    const fullName = namespace ? `${namespace}/${name}` : name
    const url = `${baseUrl}/${encodeURIComponent(fullName).replace('%40', '@')}` // npmjs doesn't handle the escaped version
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = Object.getOwnPropertyNames(answer.versions).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    return response.status(200).send(uniq(result))
  })
)

router.get(
  '/:namespace/:name?',
  asyncMiddleware(async (request, response) => {
    const { namespace, name } = request.params
    // TODO decide if we want to tone down their scoring effect
    const searchTerm = name ? `${namespace}/${name}` : namespace
    const url = `https://api.npms.io/v2/search?q=${searchTerm}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.results.map(entry => {
      return { id: entry.package.name }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
