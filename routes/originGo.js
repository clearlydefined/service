// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')

// Get versions
router.get(
  '/:namespace/:name/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { name, namespace } = request.params
      const namespacePath = `${namespace.replace(/%2f/g, '/')}`
      const url = `https://proxy.golang.org/${namespacePath}/${name}/@v/list`
      const answer = await requestPromise({ url, method: 'GET', json: true })

      // Split on new lines that are not followed by the end of the string
      // And covert into an array
      // This results in an empty string as the last element of the array
      // So we pop that element off
      const result = answer.split(/\n/)
      result.pop()

      return response.status(200).send(result)
    } catch (error) {
      return response.status(404).send('No revisions found')
    }
  })
)

// Search
router.get(
  '/:namespace/:name',
  asyncMiddleware(async (request, response) => {
    return response.status(404).send('Search not supported. Please specify a namespace and name to get revisions')
  })
)

function setup() {
  return router
}

module.exports = setup