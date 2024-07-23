// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { callFetch: requestPromise } = require('../lib/fetch')
const { uniq } = require('lodash')

// PyPi API documentation: https://warehouse.pypa.io/api-reference/json.html
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://pypi.python.org/pypi/${name}/json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer && answer.releases ? Object.keys(answer.releases) : []
    result.reverse()
    return response.status(200).send(uniq(result))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://pypi.python.org/pypi/${name}/json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer && answer.info ? [{ id: answer.info.name }] : []
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
