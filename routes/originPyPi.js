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
    const name = /** @type {string} */ (request.params.name)
    const answer = await getPypiData(name)
    const result = answer && answer.releases ? Object.keys(answer.releases) : []
    result.reverse()
    return response.status(200).send(uniq(result))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const name = /** @type {string} */ (request.params.name)
    const answer = await getPypiData(name)
    const result = answer && answer.info ? [{ id: answer.info.name }] : []
    return response.status(200).send(result)
  })
)
/** @param {string} name */
async function getPypiData(name) {
  const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
  try {
    return await requestPromise({ url, method: 'GET', json: true })
  } catch (e) {
    const error = /** @type {any} */ (e)
    if (error.statusCode === 404) return {}
    throw error
  }
}
function setup(testflag = false) {
  if (testflag) {
    const _router = /** @type {any} */ (router)
    _router._getPypiData = getPypiData
  }
  return router
}

module.exports = setup
