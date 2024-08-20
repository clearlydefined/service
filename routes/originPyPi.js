// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { uniq } = require('lodash')

// PyPi API documentation: https://warehouse.pypa.io/api-reference/json.html
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const answer = await getPypiData(name)
    const result = answer && answer.releases ? Object.keys(answer.releases) : []
    result.reverse()
    return response.status(200).send(uniq(result))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const answer = await getPypiData(name)
    const result = answer && answer.info ? [{ id: answer.info.name }] : []
    return response.status(200).send(result)
  })
)
async function getPypiData(name) {
  const url = `https://pypi.python.org/pypi/${encodeURIComponent(name)}/json`
  try {
    return await requestPromise({ url, method: 'GET', json: true })
  } catch (error) {
    if (error.statusCode === 404) return {}
    throw error
  }
}
function setup(testflag = false) {
  if (testflag) router._getPypiData = getPypiData
  return router
}

module.exports = setup
