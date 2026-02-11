// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { callFetch: requestPromise } = require('../lib/fetch')
const { deCodeSlashes } = require('../lib/utils')
const logger = require('../providers/logging/logger')

const log = logger()

// Get versions
router.get(
  '/:namespace/:name/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { name } = request.params
      const namespace = /** @type {string} */ (request.params.namespace)
      const namespacePath = `${deCodeSlashes(namespace)}`
      const url = `https://proxy.golang.org/${namespacePath}/${name}/@v/list`
      const answer = await requestPromise({ url, method: 'GET', json: true })

      // Split on new lines that are not followed by the end of the string
      // And convert into an array
      // This results in an empty string as the last element of the array
      // So we pop that element off
      const result = answer.split(/\n/)
      result.pop()

      return response.status(200).send(result)
    } catch (e) {
      const error = /** @type {Error} */ (e)
      log.error('Error fetching Go module revisions.', {
        errorMessage: error.message
      })
      return response.status(404).send('No revisions found due to an internal error.')
    }
  })
)

// Search
router.get(
  '/:namespace/:name',
  asyncMiddleware(async (_request, response) => {
    return response.status(404).send('Search not supported. Please specify a namespace and name to get revisions')
  })
)

function setup() {
  return router
}

module.exports = setup
